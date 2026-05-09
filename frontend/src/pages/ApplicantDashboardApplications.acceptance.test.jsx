import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
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
  channelCallback: null,
  subscribedChannelName: '',
}))

const dashboardSpies = vi.hoisted(() => ({
  getSession: vi.fn(),
  userMaybeSingle: vi.fn(),
  profileMaybeSingle: vi.fn(),
  applicationsOrder: vi.fn(),
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
              order: async () => ({ data: [], error: null }),
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

      return {
        select: () => ({
          eq: () => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          }),
        }),
      }
    }),
    channel: vi.fn((channelName) => {
      dashboardState.subscribedChannelName = channelName

      const channel = {
        on: vi.fn((eventName, options, callback) => {
          dashboardState.channelCallback = callback
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
  dashboardState.channelCallback = null
  dashboardState.subscribedChannelName = ''

  dashboardSpies.getSession.mockResolvedValue({
    data: { session: { user: { email: dashboardState.authEmail } } },
    error: null,
  })
  dashboardSpies.userMaybeSingle.mockResolvedValue({ data: dashboardState.userRow, error: null })
  dashboardSpies.profileMaybeSingle.mockResolvedValue({ data: dashboardState.profileRow, error: null })
  dashboardSpies.applicationsOrder.mockImplementation(async () => ({
    data: dashboardState.applicationRows,
    error: null,
  }))
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
      expect(typeof dashboardState.channelCallback).toBe('function')
    })

    await dashboardState.channelCallback()

    await waitFor(() => {
      expect(screen.getByText('Accepted')).toBeTruthy()
    })

    expect(screen.queryByText('Pending')).toBeNull()
  })
})