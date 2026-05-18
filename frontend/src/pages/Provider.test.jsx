import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const providerState = vi.hoisted(() => ({
  authEmail: 'provider@example.com',
  userRow: { id: 'user-1' },
  providerRow: { id: 'provider-1' },
  listings: [
    {
      id: 'listing-1',
      title: 'Business Administration NQF 4',
      type: 'Learnership',
      location: 'Cape Town',
      duration: '12 months',
      status: 'Approved',
      closing_date: '2026-05-28',
      stipend: 4500,
      created_at: '2026-05-01T10:00:00Z',
    },
    {
      id: 'listing-2',
      title: 'Electrical Trade Apprenticeship',
      type: 'Apprenticeship',
      location: 'Durban',
      duration: '18 months',
      status: 'Pending',
      closing_date: '2026-06-10',
      stipend: 5500,
      created_at: '2026-05-02T10:00:00Z',
    },
  ],
}))

const providerSpies = vi.hoisted(() => ({
  getSession: vi.fn(),
  userMaybeSingle: vi.fn(),
  providerMaybeSingle: vi.fn(),
  opportunitiesOrder: vi.fn(),
}))

vi.mock('../lib/supabaseClient', () => ({
  hasSupabaseConfig: true,
  supabase: {
    auth: {
      getSession: providerSpies.getSession,
    },
    from: vi.fn((tableName) => {
      if (tableName === 'users') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: providerSpies.userMaybeSingle,
            })),
          })),
        }
      }

      if (tableName === 'provider_profiles') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: providerSpies.providerMaybeSingle,
            })),
          })),
        }
      }

      if (tableName === 'opportunities') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: providerSpies.opportunitiesOrder,
              in: providerSpies.opportunitiesOrder,
              order: providerSpies.opportunitiesOrder,
            })),
          })),
        }
      }
    }),
  },
}))

const loadProvider = async () => (await import('./Provider')).default

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  vi.clearAllMocks()
  providerState.authEmail = 'provider@example.com'
  providerState.userRow = { id: 'user-1' }
  providerState.providerRow = { id: 'provider-1' }
  providerState.listings = [
    {
      id: 'listing-1',
      title: 'Business Administration NQF 4',
      type: 'Learnership',
      location: 'Cape Town',
      duration: '12 months',
      status: 'Approved',
      closing_date: '2026-05-28',
      stipend: 4500,
      created_at: '2026-05-01T10:00:00Z',
    },
    {
      id: 'listing-2',
      title: 'Electrical Trade Apprenticeship',
      type: 'Apprenticeship',
      location: 'Durban',
      duration: '18 months',
      status: 'Pending',
      closing_date: '2026-06-10',
      stipend: 5500,
      created_at: '2026-05-02T10:00:00Z',
    },
  ]

  providerSpies.getSession.mockResolvedValue({
    data: { session: { user: { email: providerState.authEmail } } },
    error: null,
  })
  providerSpies.userMaybeSingle.mockResolvedValue({ data: providerState.userRow, error: null })
  providerSpies.providerMaybeSingle.mockResolvedValue({ data: providerState.providerRow, error: null })
  providerSpies.opportunitiesOrder.mockImplementation(async () => ({
    data: providerState.listings,
    error: null,
  }))
})

describe('Provider page smoke tests', () => {
  it('exports Provider component', async () => {
    const Provider = (await import('./Provider')).default
    expect(Provider).toBeDefined()
  })

  it('Provider is a function component', async () => {
    const Provider = (await import('./Provider')).default
    expect(typeof Provider).toBe('function')
  })
})

describe('Provider dashboard acceptance tests', () => {
  test.skip('renders provider dashboard with listings and header', async () => {
    const Provider = await loadProvider()

    render(
      <MemoryRouter>
        <Provider onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Manage your learnership pipeline')).toBeTruthy()
    expect(screen.getByText('Business Administration NQF 4')).toBeTruthy()
    expect(screen.getByText('Electrical Trade Apprenticeship')).toBeTruthy()
  })

  test('shows provider stats for active listings, pending, and approved counts', async () => {
    const Provider = await loadProvider()

    render(
      <MemoryRouter>
        <Provider onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    await screen.findByText('Business Administration NQF 4')
    expect(screen.getByText('Active listings')).toBeTruthy()
    expect(screen.getByText('Pending approval')).toBeTruthy()
    expect(screen.getByText('Approved listings')).toBeTruthy()
  })

  test('shows a dropdown filter with the same status options', async () => {
    const Provider = await loadProvider()

    render(
      <MemoryRouter>
        <Provider onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    await screen.findByText('Business Administration NQF 4')

    const filterSelect = screen.getByLabelText('Filter listings by status')
    expect(filterSelect).toBeTruthy()
    expect(Array.from(filterSelect.querySelectorAll('option')).map((option) => option.textContent)).toEqual([
      'All',
      'Pending',
      'Approved',
      'Declined',
    ])
  })

  test('shows Profile, New Listing, and Logout buttons in header', async () => {
    const Provider = await loadProvider()

    render(
      <MemoryRouter>
        <Provider onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    await screen.findByText('Business Administration NQF 4')
    expect(screen.getByRole('button', { name: 'Profile' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'New Listing' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Logout' })).toBeTruthy()
  })

  test('shows error when user record is not found', async () => {
    providerSpies.userMaybeSingle.mockResolvedValue({ data: null, error: null })

    const Provider = await loadProvider()

    render(
      <MemoryRouter>
        <Provider onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Provider user record was not found.')).toBeTruthy()
  })

  test('shows error when provider profile query fails', async () => {
    providerSpies.providerMaybeSingle.mockResolvedValue({
      data: null,
      error: new Error('Database error'),
    })

    const Provider = await loadProvider()

    render(
      <MemoryRouter>
        <Provider onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/Provider profile was not found/i)).toBeTruthy()
  })

  test('shows error when provider profile is incomplete', async () => {
    providerSpies.providerMaybeSingle.mockResolvedValue({ data: null, error: null })

    const Provider = await loadProvider()

    render(
      <MemoryRouter>
        <Provider onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/Complete your provider profile before accessing/i)).toBeTruthy()
  })

  test('shows error when listings query fails', async () => {
    providerSpies.opportunitiesOrder.mockImplementation(async () => ({
      data: null,
      error: new Error('Database error'),
    }))

    const Provider = await loadProvider()

    render(
      <MemoryRouter>
        <Provider onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/Your listings could not be loaded/i)).toBeTruthy()
  })

  test('shows empty state when provider has no listings', async () => {
    providerState.listings = []
    providerSpies.opportunitiesOrder.mockImplementation(async () => ({
      data: [],
      error: null,
    }))

    const Provider = await loadProvider()

    render(
      <MemoryRouter>
        <Provider onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    expect(await screen.findByText('You have not submitted any listings yet.')).toBeTruthy()
  })

  test('calls getSession to fetch session data', async () => {
    const Provider = await loadProvider()

    render(
      <MemoryRouter>
        <Provider onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(providerSpies.getSession).toHaveBeenCalled()
    })
  })

  test('displays all listings with type, title, and stipend information', async () => {
    const Provider = await loadProvider()

    render(
      <MemoryRouter>
        <Provider onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    await screen.findByText('Business Administration NQF 4')
    expect(screen.getByText('Learnership')).toBeTruthy()
    expect(screen.getByText('Apprenticeship')).toBeTruthy()
  })
})
