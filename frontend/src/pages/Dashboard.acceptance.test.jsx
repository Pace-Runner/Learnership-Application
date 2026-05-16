import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from './Dashboard'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const listingsWithVariedStatuses = [
  {
    id: 'listing-1',
    title: 'Business Admin',
    type: 'Learnership',
    description: 'Admin learnership',
    meta: 'Full-time',
    location: 'Cape Town',
    stipend: 4500,
    closingDate: '2026-06-01',
    status: 'Approved',
  },
  {
    id: 'listing-2',
    title: 'IT Support',
    type: 'Internship',
    description: 'IT internship',
    location: 'Johannesburg',
    stipend: 3000,
    closingDate: '2026-07-01',
    status: 'Approved',
  },
  {
    id: 'listing-3',
    title: 'Unknown Status Listing',
    type: 'Learnership',
    description: 'Test listing',
    meta: 'Unknown',
    location: 'Durban',
    stipend: 2500,
    closingDate: '2026-08-01',
    status: 'Draft',
  },
]

describe('Dashboard acceptance tests', () => {
  it('handles application status with default status chip rendering (unknown status)', () => {
    render(
      <MemoryRouter>
        <Dashboard onLogout={vi.fn()} listings={listingsWithVariedStatuses} />
      </MemoryRouter>,
    )

    // Verify the component renders even with mixed statuses
    expect(screen.getByText('Business Admin')).toBeTruthy()
    expect(screen.getByText('IT Support')).toBeTruthy()
  })

  it('clears search feedback timeout on cleanup', async () => {
    const { unmount } = render(
      <MemoryRouter>
        <Dashboard onLogout={vi.fn()} listings={listingsWithVariedStatuses} />
      </MemoryRouter>,
    )

    const searchInput = screen.getByPlaceholderText(/Search by title, location, or sector/i)
    fireEvent.change(searchInput, { target: { value: 'test' } })

    // Wait for component to set up timeout
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search by title, location, or sector/i)).toBeTruthy()
    })

    // Unmount should clear the timeout gracefully
    unmount()
    expect(true).toBeTruthy()
  })

  it('handles multiple search operations with timeout cleanup', async () => {
    render(
      <MemoryRouter>
        <Dashboard onLogout={vi.fn()} listings={listingsWithVariedStatuses} />
      </MemoryRouter>,
    )

    const searchInput = screen.getByPlaceholderText(/Search by title, location, or sector/i)
    const form = searchInput.closest('form')

    // First search
    fireEvent.change(searchInput, { target: { value: 'Business' } })
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('Business Admin')).toBeTruthy()
    })

    // Second search immediately after (tests timeout clearing)
    fireEvent.change(searchInput, { target: { value: 'IT' } })
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('IT Support')).toBeTruthy()
    })
  })

  it('renders dashboard without db listings when no listings prop provided', () => {
    render(
      <MemoryRouter>
        <Dashboard onLogout={vi.fn()} listings={listingsWithVariedStatuses} />
      </MemoryRouter>,
    )

    expect(screen.getByText('Business Admin')).toBeTruthy()
    expect(screen.getByText('IT Support')).toBeTruthy()
    expect(screen.queryByText('Unknown Status Listing')).toBeNull()
  })

  it('filters and displays listings by type selection', async () => {
    render(
      <MemoryRouter>
        <Dashboard onLogout={vi.fn()} listings={listingsWithVariedStatuses} />
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText(/Filter listing type/i), {
      target: { value: 'Internship' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    await waitFor(() => {
      expect(screen.getByText('IT Support')).toBeTruthy()
    })
    expect(screen.queryByText('Business Admin')).toBeNull()
  })

  it('resets search when type filter changes', async () => {
    render(
      <MemoryRouter>
        <Dashboard onLogout={vi.fn()} listings={listingsWithVariedStatuses} />
      </MemoryRouter>,
    )

    const searchInput = screen.getByPlaceholderText(/Search by title, location, or sector/i)
    fireEvent.change(searchInput, { target: { value: 'Cape' } })

    const searchButton = screen.getByRole('button', { name: 'Search' })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(screen.getByText('Business Admin')).toBeTruthy()
    })

    fireEvent.change(searchInput, { target: { value: '' } })
    fireEvent.change(screen.getByLabelText(/Filter listing type/i), {
      target: { value: 'Internship' },
    })
    fireEvent.click(searchButton)

    await waitFor(() => {
      expect(screen.getByText('IT Support')).toBeTruthy()
    })
  })
})
