import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

const {
  mockGetSession,
  mockOnAuthStateChange,
  mockRoleLookup,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockRoleLookup: vi.fn(),
}))

vi.mock('./pages/Dashboard', () => ({
  default: () => <div>Applicant Dashboard</div>,
}))

vi.mock('./pages/Provider', () => ({
  default: () => <div>Provider Workspace</div>,
}))

vi.mock('./pages/Admin', () => ({
  default: () => <div>Admin Workspace</div>,
}))

vi.mock('./pages/ApplicantProfile', () => ({
  default: () => <div>Applicant Profile Workspace</div>,
}))

vi.mock('./pages/ProviderListingForm', () => ({
  default: () => <div>Provider Listing Form</div>,
}))

vi.mock('./pages/ProviderListingEdit', () => ({
  default: () => <div>Provider Listing Edit</div>,
}))

vi.mock('./lib/supabaseClient', () => ({
  hasSupabaseConfig: true,
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn((table) => {
      if (table !== 'users') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
          upsert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
        }
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: mockRoleLookup,
          })),
        })),
        upsert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({ data: { role: 'Admin' }, error: null })),
          })),
        })),
      }
    }),
  },
}))

function renderApp(pathname) {
  render(
    <MemoryRouter initialEntries={[pathname]}>
      <App />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockGetSession.mockResolvedValue({
    data: { session: null },
    error: null,
  })
  mockRoleLookup.mockResolvedValue({ data: null, error: null })
  mockOnAuthStateChange.mockReturnValue({
    data: {
      subscription: {
        unsubscribe: vi.fn(),
      },
    },
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Role-based routing runtime behavior', () => {
  test('shows loading shell while auth bootstrap is in progress', () => {
    mockGetSession.mockImplementation(
      () => new Promise(() => {}),
    )

    renderApp('/admin')
    expect(screen.getByText(/Checking your session/i)).toBeTruthy()
  })

  test('redirects unauthenticated users from protected route to home', async () => {
    renderApp('/admin')

    await waitFor(() => {
      expect(screen.getByText(/BUILDING TALENT/i)).toBeTruthy()
    })
  })

  test('renders admin workspace when signed-in user has Admin role', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { email: 'admin@example.com' } } },
      error: null,
    })
    mockRoleLookup.mockResolvedValue({ data: { role: 'Admin' }, error: null })

    renderApp('/admin')
    await waitFor(() => {
      expect(screen.getByText('Admin Workspace')).toBeTruthy()
    })
  })

  test('restores configured admin email to Admin role when no users row exists', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { email: 'connor@yourdomain.com' } } },
      error: null,
    })
    mockRoleLookup.mockResolvedValue({ data: null, error: null })

    renderApp('/admin')
    await waitFor(() => {
      expect(screen.getByText('Admin Workspace')).toBeTruthy()
    })
  })

  test('renders provider workspace when signed-in user has Provider role', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { email: 'provider@example.com' } } },
      error: null,
    })
    mockRoleLookup.mockResolvedValue({ data: { role: 'Provider' }, error: null })

    renderApp('/provider')
    await waitFor(() => {
      expect(screen.getByText('Provider Workspace')).toBeTruthy()
    })
  })

  test('renders applicant dashboard when signed-in user has Applicant role', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { email: 'applicant@example.com' } } },
      error: null,
    })
    mockRoleLookup.mockResolvedValue({ data: { role: 'Applicant' }, error: null })

    renderApp('/dashboard')
    await waitFor(() => {
      expect(screen.getByText('Applicant Dashboard')).toBeTruthy()
    })
  })

  test('redirects signed-in applicant away from Provider-only route', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { email: 'applicant@example.com' } } },
      error: null,
    })
    mockRoleLookup.mockResolvedValue({ data: { role: 'Applicant' }, error: null })

    renderApp('/provider')
    await waitFor(() => {
      expect(screen.getByText(/BUILDING TALENT/i)).toBeTruthy()
    })
  })

  test('auto-redirects signed-in Provider from home to provider route', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { email: 'provider@example.com' } } },
      error: null,
    })
    mockRoleLookup.mockResolvedValue({ data: { role: 'Provider' }, error: null })

    renderApp('/')
    await waitFor(() => {
      expect(screen.getByText('Provider Workspace')).toBeTruthy()
    })
  })
})
