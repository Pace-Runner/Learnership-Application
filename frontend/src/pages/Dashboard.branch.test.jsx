import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const dashboardState = vi.hoisted(() => ({
  hasSupabaseConfig: true,
  sessionError: false,
  sessionEmail: 'applicant@example.com',
  userRow: { id: 'user-1' },
  userError: false,
}))

const dashboardSpies = vi.hoisted(() => ({
  getSession: vi.fn(),
  userMaybeSingle: vi.fn(),
}))

vi.mock('../lib/supabaseClient', () => ({
  get hasSupabaseConfig() {
    return dashboardState.hasSupabaseConfig
  },
  supabase: {
    auth: {
      getSession: dashboardSpies.getSession,
    },
    from: vi.fn((tableName) => {
      if (tableName === 'users') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: dashboardSpies.userMaybeSingle,
            }),
          }),
        }
      }

      return {
        select: () => ({
          eq: () => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            order: vi.fn(async () => ({ data: [], error: null })),
          }),
        }),
      }
    }),
    channel: vi.fn(() => ({ on: vi.fn(() => ({ subscribe: vi.fn() })) })),
    removeChannel: vi.fn(),
  },
}))

const loadDashboard = async () => (await import('./Dashboard')).default

beforeEach(() => {
  vi.clearAllMocks()
  dashboardState.hasSupabaseConfig = true
  dashboardState.sessionError = false
  dashboardState.sessionEmail = 'applicant@example.com'
  dashboardState.userRow = { id: 'user-1' }
  dashboardState.userError = false

  dashboardSpies.getSession.mockImplementation(async () => ({
    data: {
      session: {
        user: {
          email: dashboardState.sessionEmail,
        },
      },
    },
    error: dashboardState.sessionError ? new Error('session failed') : null,
  }))

  dashboardSpies.userMaybeSingle.mockImplementation(async () => ({
    data: dashboardState.userRow,
    error: dashboardState.userError ? new Error('user failed') : null,
  }))
})

afterEach(() => {
  cleanup()
})

describe('Dashboard branch coverage tests', () => {
  test('falls back to built-in listings when Supabase is unavailable', async () => {
    dashboardState.hasSupabaseConfig = false
    const Dashboard = await loadDashboard()

    render(
      <MemoryRouter>
        <Dashboard onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    expect(screen.getByText('Business Administration NQF 4')).toBeTruthy()
    expect(screen.getByText('Junior IT Support Internship')).toBeTruthy()
    expect(screen.getByText('Electrical Trade Apprenticeship')).toBeTruthy()
    expect(screen.getByText('You have not submitted any applications yet.')).toBeTruthy()
    expect(screen.getByText('You do not have any unread notifications right now.')).toBeTruthy()
  })

  test('shows the account identity error when the session has no email', async () => {
    dashboardState.sessionEmail = ''
    const Dashboard = await loadDashboard()

    render(
      <MemoryRouter>
        <Dashboard onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    expect(await screen.findByText('We could not identify your applicant account.')).toBeTruthy()
  })

  test('shows the account not found error when the user query fails', async () => {
    dashboardState.userError = true
    const Dashboard = await loadDashboard()

    render(
      <MemoryRouter>
        <Dashboard onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Your applicant account was not found.')).toBeTruthy()
  })
})
