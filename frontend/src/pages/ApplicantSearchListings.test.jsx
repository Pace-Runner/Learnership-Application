import { afterEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../lib/supabaseClient', () => ({
  hasSupabaseConfig: true,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signOut: vi.fn(async () => ({ error: null })),
      signInWithOAuth: vi.fn(async () => ({ error: null })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          order: vi.fn(async () => ({ data: [], error: null })),
        })),
      })),
    })),
  },
}))

import App from '../App'
import Dashboard from './Dashboard'

const sampleListings = [
  {
    id: 'approved-1',
    title: 'IT Support Internship 2026',
    type: 'Internship',
    description: 'Support helpdesk operations and endpoint troubleshooting',
    location: 'Cape Town',
    closing_date: '2026-05-30',
    status: 'Approved',
  },
  {
    id: 'approved-2',
    title: 'Business Admin Learnership 2026',
    type: 'Learnership',
    description: 'Entry-level office administration training',
    location: 'Johannesburg',
    closing_date: '2026-05-28',
    status: 'Approved',
  },
  {
    id: 'approved-3',
    title: 'Customer Support Internship Cohort A',
    type: 'Internship',
    description: 'Support inbound customer queries and ticket handling',
    location: 'Pretoria',
    closing_date: '2026-06-11',
    status: 'Approved',
  },
  {
    id: 'approved-4',
    title: 'Electrical Apprentice Intake A',
    type: 'Apprenticeship',
    description: 'Workshop-based electrical apprenticeship training',
    location: 'Cape Town',
    closing_date: '2026-06-04',
    status: 'Approved',
  },
  {
    id: 'pending-1',
    title: 'Pending IT Support Intake',
    type: 'Internship',
    description: 'Pending support listing that must never show',
    location: 'Cape Town',
    closing_date: '2026-06-08',
    status: 'Pending',
  },
  {
    id: 'removed-1',
    title: 'Removed Cape Town Learnership',
    type: 'Learnership',
    description: 'Removed listing that must never show',
    location: 'Cape Town',
    closing_date: '2026-06-14',
    status: 'Removed',
  },
]

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard onLogout={vi.fn()} listings={sampleListings} />
    </MemoryRouter>,
  )
}

async function submitSearch({ term = '', type = 'All' } = {}) {
  fireEvent.change(screen.getByPlaceholderText('Search by title, location, or sector'), {
    target: { value: term },
  })
  fireEvent.change(screen.getByLabelText('Filter listing type'), {
    target: { value: type },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))

  await waitFor(() => {
    expect(screen.queryByText('Searching approved listings...')).toBeNull()
  })
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Applicant search listings', () => {
  test('renders search bar and listing type filter on the dashboard', () => {
    renderDashboard()

    expect(screen.getByPlaceholderText('Search by title, location, or sector')).toBeTruthy()
    expect(screen.getByLabelText('Filter listing type')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy()
  })

  test('shows only approved listings by default', () => {
    renderDashboard()

    expect(screen.getByText('IT Support Internship 2026')).toBeTruthy()
    expect(screen.getByText('Business Admin Learnership 2026')).toBeTruthy()
    expect(screen.getByText('Customer Support Internship Cohort A')).toBeTruthy()
    expect(screen.getByText('Electrical Apprentice Intake A')).toBeTruthy()
    expect(screen.queryByText('Pending IT Support Intake')).toBeNull()
    expect(screen.queryByText('Removed Cape Town Learnership')).toBeNull()
  })

  test('returns matching approved listings for a keyword search', () => {
    renderDashboard()

    return submitSearch({ term: 'office' }).then(() => {
      expect(screen.getByText('Business Admin Learnership 2026')).toBeTruthy()
      expect(screen.queryByText('IT Support Internship 2026')).toBeNull()
    })
  })

  test('finds listings by location entered into the search bar', async () => {
    renderDashboard()

    await submitSearch({ term: 'Cape Town' })

    expect(screen.getByText('IT Support Internship 2026')).toBeTruthy()
    expect(screen.getByText('Electrical Apprentice Intake A')).toBeTruthy()
    expect(screen.queryByText('Business Admin Learnership 2026')).toBeNull()
    expect(screen.queryByText('Customer Support Internship Cohort A')).toBeNull()
  })

  test('uses the search term and type filter together', async () => {
    renderDashboard()

    await submitSearch({ term: 'customer', type: 'Internship' })

    expect(screen.getByText('Customer Support Internship Cohort A')).toBeTruthy()
    expect(screen.queryByText('Business Admin Learnership 2026')).toBeNull()
    expect(screen.queryByText('IT Support Internship 2026')).toBeNull()
  })

  test('updates the results panel without a full page reload', async () => {
    renderDashboard()

    await submitSearch({ term: 'electrical' })

    expect(screen.getByRole('heading', { name: 'Current Listings and Internships' })).toBeTruthy()
    expect(screen.getByText('Electrical Apprentice Intake A')).toBeTruthy()
    expect(screen.queryByText('Customer Support Internship Cohort A')).toBeNull()
  })

  test('restores the full approved listings list after clearing the search and resetting the filter', async () => {
    renderDashboard()

    await submitSearch({ term: 'electrical', type: 'Apprenticeship' })

    expect(screen.queryByText('Business Admin Learnership 2026')).toBeNull()

    await submitSearch({ term: '', type: 'All' })

    expect(screen.getByText('IT Support Internship 2026')).toBeTruthy()
    expect(screen.getByText('Business Admin Learnership 2026')).toBeTruthy()
    expect(screen.getByText('Customer Support Internship Cohort A')).toBeTruthy()
    expect(screen.getByText('Electrical Apprentice Intake A')).toBeTruthy()
  })

  test('shows a clear no-results message when nothing matches', async () => {
    renderDashboard()

    await submitSearch({ term: 'biochemistry' })

    expect(screen.getByText('No approved listings matched your search.')).toBeTruthy()
  })

  test('search is case insensitive', async () => {
    renderDashboard()

    await submitSearch({ term: 'CAPE TOWN' })

    expect(screen.getByText('IT Support Internship 2026')).toBeTruthy()
    expect(screen.getByText('Electrical Apprentice Intake A')).toBeTruthy()
  })

  test('never shows pending listings even when the keyword matches', async () => {
    renderDashboard()

    await submitSearch({ term: 'Pending' })

    expect(screen.queryByText('Pending IT Support Intake')).toBeNull()
    expect(screen.getByText('No approved listings matched your search.')).toBeTruthy()
  })

  test('never shows removed listings even when the keyword matches', async () => {
    renderDashboard()

    await submitSearch({ term: 'Removed' })

    expect(screen.queryByText('Removed Cape Town Learnership')).toBeNull()
    expect(screen.getByText('No approved listings matched your search.')).toBeTruthy()
  })

  test('shows a brief searching state in the listings panel after submit', () => {
    vi.useFakeTimers()
    renderDashboard()

    fireEvent.change(screen.getByPlaceholderText('Search by title, location, or sector'), {
      target: { value: 'Cape Town' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    expect(screen.getByText('Searching approved listings...')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(screen.queryByText('Searching approved listings...')).toBeNull()
    expect(screen.getByText('IT Support Internship 2026')).toBeTruthy()
  })

  test.skip('redirects unauthenticated users away from the listings page', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/BUILDING TALENT/i)).toBeTruthy()
    expect(screen.queryByText('Current Listings and Internships')).toBeNull()
  })
})
