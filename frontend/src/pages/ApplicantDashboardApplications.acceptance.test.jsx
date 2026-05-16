import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const dashboardState = vi.hoisted(() => ({
  authEmail: 'applicant@example.com',
  userRow: { id: 'user-1' },
  profileRow: { id: 'profile-1', user_id: 'user-1' },
  applicationRows: [
    {
      id: 'application-1',
      status: 'Pending',
      applied_at: '2026-05-01T10:00:00.000Z',
      opportunities: {
        title: 'Business Administration NQF 4',
        type: 'Learnership',
        location: 'Cape Town',
        closing_date: '2026-06-01',
      },
    },
    {
      id: 'application-2',
      status: 'Shortlisted',
      applied_at: '2026-05-02T10:00:00.000Z',
      opportunities: {
        title: 'Junior IT Support Internship',
        type: 'Internship',
        location: 'Johannesburg',
        closing_date: '2026-06-08',
      },
    },
    {
      id: 'application-3',
      status: 'Offered',
      applied_at: '2026-05-03T10:00:00.000Z',
      opportunities: {
        title: 'Electrical Trade Apprenticeship',
        type: 'Apprenticeship',
        location: 'Durban',
        closing_date: '2026-06-15',
      },
    },
    {
      id: 'application-4',
      status: 'Rejected',
      applied_at: '2026-05-04T10:00:00.000Z',
      opportunities: {
        title: 'Customer Support Internship',
        type: 'Internship',
        location: 'Pretoria',
        closing_date: '2026-06-20',
      },
    },
  ],
  notificationsRows: [
    {
      id: 'notification-1',
      type: 'status_update',
      message: 'Your application for Business Administration NQF 4 is now Reviewed.',
      read: false,
      created_at: '2026-05-05T08:15:00.000Z',
    },
  ],
  approvedRows: [],
  favouriteRows: [],
  channelCallbacks: {},
}))

const dashboardSpies = vi.hoisted(() => ({
  getSession: vi.fn(),
  userMaybeSingle: vi.fn(),
  profileMaybeSingle: vi.fn(),
  opportunitiesOrder: vi.fn(),
  applicationsOrder: vi.fn(),
  notificationsOrder: vi.fn(),
  notificationsMarkReadEq: vi.fn(),
  favouritesOrder: vi.fn(),
  favouritesInsert: vi.fn(),
  favouritesDeleteOpportunityEq: vi.fn(),
  removeChannel: vi.fn(),
}))

vi.mock('../lib/supabaseClient', () => ({
  hasSupabaseConfig: true,
  supabase: {
    auth: {
      getSession: dashboardSpies.getSession,
    },
    from: vi.fn((tableName) => {
      if (tableName === 'opportunities') {
        return {
          select: () => ({
            eq: () => ({
              order: dashboardSpies.opportunitiesOrder,
            }),
          }),
        }
      }

      if (tableName === 'users') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: dashboardSpies.userMaybeSingle,
            }),
          }),
        }
      }

      if (tableName === 'applicant_profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: dashboardSpies.profileMaybeSingle,
            }),
          }),
        }
      }

      if (tableName === 'applications') {
        return {
          select: () => ({
            eq: () => ({
              order: dashboardSpies.applicationsOrder,
            }),
          }),
        }
      }

      if (tableName === 'notifications') {
        return {
          select: () => ({
            eq: () => ({
              order: dashboardSpies.notificationsOrder,
            }),
          }),
          update: () => ({
            eq: dashboardSpies.notificationsMarkReadEq,
          }),
        }
      }

      if (tableName === 'favourites') {
        return {
          select: () => ({
            eq: () => ({
              order: dashboardSpies.favouritesOrder,
            }),
          }),
          insert: dashboardSpies.favouritesInsert,
          delete: () => ({
            eq: () => ({
              eq: dashboardSpies.favouritesDeleteOpportunityEq,
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
    channel: vi.fn((channelName) => {
      const channel = {
        on: vi.fn((eventName, options, callback) => {
          dashboardState.channelCallbacks[channelName] = callback
          return channel
        }),
        subscribe: vi.fn(() => channel),
      }

      return channel
    }),
    removeChannel: dashboardSpies.removeChannel,
  },
}))

const loadDashboard = async () => (await import('./Dashboard')).default

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  vi.clearAllMocks()
  dashboardState.authEmail = 'applicant@example.com'
  dashboardState.userRow = { id: 'user-1' }
  dashboardState.profileRow = { id: 'profile-1', user_id: 'user-1' }
  dashboardState.applicationRows = [
    {
      id: 'application-1',
      status: 'Pending',
      applied_at: '2026-05-01T10:00:00.000Z',
      opportunities: {
        title: 'Business Administration NQF 4',
        type: 'Learnership',
        location: 'Cape Town',
        closing_date: '2026-06-01',
      },
    },
    {
      id: 'application-2',
      status: 'Shortlisted',
      applied_at: '2026-05-02T10:00:00.000Z',
      opportunities: {
        title: 'Junior IT Support Internship',
        type: 'Internship',
        location: 'Johannesburg',
        closing_date: '2026-06-08',
      },
    },
    {
      id: 'application-3',
      status: 'Offered',
      applied_at: '2026-05-03T10:00:00.000Z',
      opportunities: {
        title: 'Electrical Trade Apprenticeship',
        type: 'Apprenticeship',
        location: 'Durban',
        closing_date: '2026-06-15',
      },
    },
    {
      id: 'application-4',
      status: 'Rejected',
      applied_at: '2026-05-04T10:00:00.000Z',
      opportunities: {
        title: 'Customer Support Internship',
        type: 'Internship',
        location: 'Pretoria',
        closing_date: '2026-06-20',
      },
    },
  ]
  dashboardState.notificationsRows = [
    {
      id: 'notification-1',
      type: 'status_update',
      message: 'Your application for Business Administration NQF 4 is now Reviewed.',
      read: false,
      created_at: '2026-05-05T08:15:00.000Z',
    },
  ]
  dashboardState.approvedRows = []
  dashboardState.favouriteRows = []
  dashboardState.channelCallbacks = {}

  dashboardSpies.getSession.mockResolvedValue({
    data: { session: { user: { email: dashboardState.authEmail } } },
    error: null,
  })
  dashboardSpies.userMaybeSingle.mockResolvedValue({ data: dashboardState.userRow, error: null })
  dashboardSpies.profileMaybeSingle.mockResolvedValue({ data: dashboardState.profileRow, error: null })
  dashboardSpies.opportunitiesOrder.mockImplementation(async () => ({
    data: dashboardState.approvedRows,
    error: null,
  }))
  dashboardSpies.applicationsOrder.mockImplementation(async () => ({
    data: dashboardState.applicationRows,
    error: null,
  }))
  dashboardSpies.notificationsOrder.mockImplementation(async () => ({
    data: dashboardState.notificationsRows,
    error: null,
  }))
  dashboardSpies.notificationsMarkReadEq.mockResolvedValue({ data: null, error: null })
  dashboardSpies.favouritesOrder.mockImplementation(async () => ({
    data: dashboardState.favouriteRows,
    error: null,
  }))
  dashboardSpies.favouritesInsert.mockResolvedValue({ data: null, error: null })
  dashboardSpies.favouritesDeleteOpportunityEq.mockResolvedValue({ data: null, error: null })
  dashboardSpies.removeChannel.mockResolvedValue({})
})

describe('Applicant dashboard application tracking acceptance tests', () => {
  test('shows each submitted application with the requested status label', async () => {
    const Dashboard = await loadDashboard()

    render(
      <MemoryRouter>
        <Dashboard onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    expect(await screen.findByText('My Applications')).toBeTruthy()
    expect(screen.getByText('Business Administration NQF 4')).toBeTruthy()
    expect(screen.getByText('Junior IT Support Internship')).toBeTruthy()
    expect(screen.getByText('Electrical Trade Apprenticeship')).toBeTruthy()
    expect(screen.getByText('Customer Support Internship')).toBeTruthy()
    expect(screen.getByText('Pending')).toBeTruthy()
    expect(screen.getByText('Reviewed')).toBeTruthy()
    expect(screen.getByText('Accepted')).toBeTruthy()
    expect(screen.getByText('Rejected')).toBeTruthy()
  })

  test('shows unread notifications, marks them as read on click, and lets the applicant reveal read history', async () => {
    const Dashboard = await loadDashboard()

    render(
      <MemoryRouter>
        <Dashboard onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Notifications')).toBeTruthy()

    await waitFor(() => {
      expect(dashboardSpies.notificationsOrder).toHaveBeenCalled()
    })

    expect(screen.getByText('Your application for Business Administration NQF 4 is now Reviewed.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Mark as read' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }))

    await waitFor(() => {
      expect(dashboardSpies.notificationsMarkReadEq).toHaveBeenCalledWith('id', 'notification-1')
    })

    expect(screen.queryByText('Your application for Business Administration NQF 4 is now Reviewed.')).toBeNull()
    expect(screen.getByText('You do not have any unread notifications right now.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Show read notifications' }))

    expect(screen.getByText('Your application for Business Administration NQF 4 is now Reviewed.')).toBeTruthy()
    expect(screen.getByText('Read')).toBeTruthy()
  })

  test('refreshes the status display when a realtime application update arrives', async () => {
    const Dashboard = await loadDashboard()

    render(
      <MemoryRouter>
        <Dashboard onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Pending')).toBeTruthy()

    dashboardState.applicationRows = [
      {
        id: 'application-1',
        status: 'Offered',
        applied_at: '2026-05-01T10:00:00.000Z',
        opportunities: {
          title: 'Business Administration NQF 4',
          type: 'Learnership',
          location: 'Cape Town',
          closing_date: '2026-06-01',
        },
      },
    ]

    await waitFor(() => {
      expect(typeof dashboardState.channelCallbacks['applicant-applications-profile-1']).toBe('function')
    })

    await dashboardState.channelCallbacks['applicant-applications-profile-1']()

    await waitFor(() => {
      expect(screen.getByText('Accepted')).toBeTruthy()
    })

    expect(screen.queryByText('Pending')).toBeNull()
  })

  test('refreshes the notification inbox when a realtime notification arrives', async () => {
    const Dashboard = await loadDashboard()

    dashboardState.notificationsRows = []

    render(
      <MemoryRouter>
        <Dashboard onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    expect(await screen.findByText('No unread alerts')).toBeTruthy()
    expect(screen.getByText('You do not have any unread notifications right now.')).toBeTruthy()

    dashboardState.notificationsRows = [
      {
        id: 'notification-2',
        type: 'status_update',
        message: 'Your application for Business Administration NQF 4 is now Accepted.',
        read: false,
        created_at: '2026-05-06T11:45:00.000Z',
      },
    ]

    await waitFor(() => {
      expect(typeof dashboardState.channelCallbacks['applicant-notifications-user-1']).toBe('function')
    })

    await dashboardState.channelCallbacks['applicant-notifications-user-1']()

    await waitFor(() => {
      expect(screen.getByText('Your application for Business Administration NQF 4 is now Accepted.')).toBeTruthy()
    })

    expect(screen.getByRole('button', { name: 'Mark as read' })).toBeTruthy()
  })
})
