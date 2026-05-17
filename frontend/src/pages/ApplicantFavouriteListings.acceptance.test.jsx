import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from './Dashboard'

const favouriteState = vi.hoisted(() => ({
  authEmail: 'applicant@example.com',
  userRow: { id: 'user-1' },
  profileRow: { id: 'profile-1', user_id: 'user-1' },
  approvedRows: [
    {
      id: 'listing-1',
      title: 'Listing Test',
      type: 'Learnership',
      description: 'Saved listing acceptance test',
      location: 'Cape Town',
      closing_date: '2026-10-10',
      stipend: 2400,
      status: 'Approved',
    },
  ],
  favouriteRows: [],
  applicationRows: [],
  notificationRows: [],
}))

const favouriteSpies = vi.hoisted(() => ({
  getSession: vi.fn(),
  userMaybeSingle: vi.fn(),
  profileMaybeSingle: vi.fn(),
  opportunitiesOrder: vi.fn(),
  applicationsOrder: vi.fn(),
  notificationsOrder: vi.fn(),
  favouritesOrder: vi.fn(),
  favouritesMaybeSingle: vi.fn(),
  favouritesInsert: vi.fn(),
  favouritesInsertMaybeSingle: vi.fn(),
  favouritesDeleteOpportunityEq: vi.fn(),
  removeChannel: vi.fn(),
}))

vi.mock('../lib/supabaseClient', () => ({
  hasSupabaseConfig: true,
  supabase: {
    auth: {
      getSession: favouriteSpies.getSession,
    },
    from: vi.fn((tableName) => {
      if (tableName === 'opportunities') {
        return {
          select: () => ({
            eq: () => ({
              order: favouriteSpies.opportunitiesOrder,
            }),
          }),
        }
      }

      if (tableName === 'users') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: favouriteSpies.userMaybeSingle,
            }),
          }),
        }
      }

      if (tableName === 'applicant_profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: favouriteSpies.profileMaybeSingle,
            }),
          }),
        }
      }

      if (tableName === 'applications') {
        return {
          select: () => ({
            eq: () => ({
              order: favouriteSpies.applicationsOrder,
            }),
          }),
        }
      }

      if (tableName === 'notifications') {
        return {
          select: () => ({
            eq: () => ({
              order: favouriteSpies.notificationsOrder,
            }),
          }),
        }
      }

      if (tableName === 'favourites') {
        return {
          select: () => ({
            eq: () => ({
              order: favouriteSpies.favouritesOrder,
              eq: () => ({
                maybeSingle: favouriteSpies.favouritesMaybeSingle,
              }),
            }),
          }),
          insert: favouriteSpies.favouritesInsert,
          delete: () => ({
            eq: () => ({
              eq: favouriteSpies.favouritesDeleteOpportunityEq,
            }),
          }),
        }
      }

      return {
        select: () => ({
          eq: () => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          }),
        }),
      }
    }),
    channel: vi.fn(() => {
      const channel = {
        on: vi.fn(() => channel),
        subscribe: vi.fn(() => channel),
      }

      return channel
    }),
    removeChannel: favouriteSpies.removeChannel,
  },
}))

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard onLogout={vi.fn()} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()

  favouriteState.favouriteRows = []
  favouriteState.applicationRows = []
  favouriteState.notificationRows = []

  favouriteSpies.getSession.mockResolvedValue({
    data: { session: { user: { email: favouriteState.authEmail } } },
    error: null,
  })
  favouriteSpies.userMaybeSingle.mockResolvedValue({ data: favouriteState.userRow, error: null })
  favouriteSpies.profileMaybeSingle.mockResolvedValue({ data: favouriteState.profileRow, error: null })
  favouriteSpies.opportunitiesOrder.mockImplementation(async () => ({
    data: favouriteState.approvedRows,
    error: null,
  }))
  favouriteSpies.applicationsOrder.mockImplementation(async () => ({
    data: favouriteState.applicationRows,
    error: null,
  }))
  favouriteSpies.notificationsOrder.mockImplementation(async () => ({
    data: favouriteState.notificationRows,
    error: null,
  }))
  favouriteSpies.favouritesOrder.mockImplementation(async () => ({
    data: favouriteState.favouriteRows,
    error: null,
  }))
  favouriteSpies.favouritesMaybeSingle.mockResolvedValue({ data: null, error: null })
  favouriteSpies.favouritesInsert.mockResolvedValue({ data: null, error: null })
  favouriteSpies.favouritesDeleteOpportunityEq.mockResolvedValue({ data: null, error: null })
  favouriteSpies.removeChannel.mockResolvedValue({})
})

afterEach(() => {
  cleanup()
})

describe('Applicant favourite listings acceptance tests', () => {
  test('saves an approved listing to the applicant favourites table', async () => {
    renderDashboard()

    expect(await screen.findByText('Listing Test')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Favourites' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Current Listings and Internships' }))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Favorite Listing Test' }))
    })

    await waitFor(() => {
      expect(favouriteSpies.favouritesInsert).toHaveBeenCalledWith({
        applicant_id: 'profile-1',
        opportunity_id: 'listing-1',
      })
    })

    await waitFor(() => {
      expect(screen.getByText('1 favourited')).toBeTruthy()
    })
    expect(screen.getByRole('button', { name: 'Listing Test is already favourited' }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('tab', { name: 'Favourites' }))
    expect(screen.getByRole('button', { name: 'Remove favourited Listing Test' })).toBeTruthy()
  })

  test('loads favourited opportunities and removes a favourite listing', async () => {
    favouriteState.favouriteRows = [
      {
        id: 'favourite-1',
        opportunity_id: 'listing-1',
        created_at: '2026-05-16T10:00:00.000Z',
        opportunities: favouriteState.approvedRows[0],
      },
    ]

    renderDashboard()

    expect(await screen.findByText('1 favourited')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Favourites' }))
    expect(screen.getByRole('button', { name: 'Remove favourited Listing Test' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Remove favourited Listing Test' }))

    await waitFor(() => {
      expect(favouriteSpies.favouritesDeleteOpportunityEq).toHaveBeenCalledWith('opportunity_id', 'listing-1')
    })

    expect(screen.getByText('You have not favourited any opportunities yet.')).toBeTruthy()
  })
})
