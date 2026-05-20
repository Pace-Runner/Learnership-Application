import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from './Dashboard'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const listings = [
  {
    id: 'listing-1',
    title: 'Business Administration NQF 4',
    type: 'Learnership',
    description: 'Office support and administration track',
    meta: 'Full-time office-based learnership',
    location: 'Cape Town',
    stipend: 4500,
    closingDate: '2026-06-01',
    status: 'Approved',
  },
  {
    id: 'listing-2',
    title: 'Junior IT Support Internship',
    type: 'Internship',
    description: 'Hands-on support role',
    location: 'Johannesburg',
    stipend: 3000,
    closingDate: '2026-07-01',
    status: 'Approved',
  },
]

describe('Dashboard coverage tests', () => {
  test('shows approved listings and the empty search state with listings prop', () => {
    render(
      <MemoryRouter>
        <Dashboard onLogout={vi.fn()} listings={listings} />
      </MemoryRouter>,
    )

    expect(screen.getByText('Business Administration NQF 4')).toBeTruthy()
    expect(screen.getByText('Junior IT Support Internship')).toBeTruthy()
    expect(screen.getByText('02')).toBeTruthy()
    expect(screen.getAllByText('00')).toHaveLength(2)
    expect(screen.getAllByLabelText(/Provider profile picture for/i)).toHaveLength(2)
  })

  test('searching for a missing listing shows the no-results state', async () => {
    render(
      <MemoryRouter>
        <Dashboard onLogout={vi.fn()} listings={listings} />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByPlaceholderText(/Search by title, location, or sector/i), {
      target: { value: 'marketing' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Search' }).closest('form'))

    expect(await screen.findByText(/No approved listings matched your search/i)).toBeTruthy()
  })

  test('searching by location keeps only the matching approved listing', async () => {
    render(
      <MemoryRouter>
        <Dashboard onLogout={vi.fn()} listings={listings} />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByPlaceholderText(/Search by title, location, or sector/i), {
      target: { value: 'Cape Town' },
    })
    fireEvent.submit(screen.getByRole('button', { name: 'Search' }).closest('form'))

    expect(await screen.findByText('Business Administration NQF 4')).toBeTruthy()
    expect(screen.queryByText('Junior IT Support Internship')).toBeNull()
    expect(screen.getByRole('link', { name: /View details for Business Administration NQF 4/i })).toBeTruthy()
  })
})
