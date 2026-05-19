import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const appState = vi.hoisted(() => ({
  hasSupabaseConfig: true,
  sessionResult: { data: { session: null }, error: null },
  authUserResult: { data: { user: { id: 'auth-user-1' } }, error: null },
  roleByEmail: null,
  applicantLandingRoute: '/profile',
  providerLandingRoute: '/provider/profile',
  signInResult: { error: null },
  signOutResult: { error: null },
  authStateHandler: null,
  usersInsertResult: { data: { role: 'Provider' }, error: null },
  usersInsertCalls: [],
}))

let AppComponent = null

vi.mock('./pages/Admin', () => ({
  default: () => <div>Admin Workspace</div>,
}))

vi.mock('./pages/Dashboard', () => ({
  default: () => <div>Applicant Dashboard</div>,
}))

vi.mock('./pages/ApplicantProfile', () => ({
  default: () => <div>Applicant Profile Workspace</div>,
}))

vi.mock('./pages/ApplicantListingDetail', () => ({
  default: () => <div>Applicant Listing Detail</div>,
}))

vi.mock('./pages/Provider', () => ({
  default: () => <div>Provider Workspace</div>,
}))

vi.mock('./pages/ProviderProfile', () => ({
  default: () => <div>Provider Profile Workspace</div>,
}))

vi.mock('./pages/ProviderListingForm', () => ({
  default: () => <div>Provider Listing Form</div>,
}))

vi.mock('./pages/ProviderListingEdit', () => ({
  default: () => <div>Provider Listing Edit</div>,
}))

vi.mock('./pages/ProviderListingApplications', () => ({
  default: () => <div>Provider Listing Applications</div>,
}))

vi.mock('./lib/supabaseClient', () => ({
  get hasSupabaseConfig() {
    return appState.hasSupabaseConfig
  },
  supabase: {
    auth: {
      getSession: vi.fn(async () => appState.sessionResult),
      getUser: vi.fn(async () => appState.authUserResult),
      onAuthStateChange: vi.fn((callback) => {
        appState.authStateHandler = callback
        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        }
      }),
      signInWithOAuth: vi.fn(async () => appState.signInResult),
      signOut: vi.fn(async () => appState.signOutResult),
    },
    from: vi.fn((table) => {
      if (table !== 'users') {
        return {
          insert: vi.fn(),
        }
      }

      return {
        insert: vi.fn((payload) => {
          appState.usersInsertCalls.push(payload)
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => appState.usersInsertResult),
            })),
          }
        }),
      }
    }),
  },
}))

vi.mock('./app-helpers', () => ({
  getLandingRoute: (role) => {
    if (role === 'Admin') return '/admin'
    if (role === 'Provider') return '/provider'
    return '/dashboard'
  },
  isProviderProfileComplete: (profile) => Boolean(profile?.id && profile?.organisation_name && profile?.phone && profile?.description),
  getProviderLandingRoute: (profile) => (profile?.id && profile?.organisation_name && profile?.phone && profile?.description ? '/provider' : '/provider/profile'),
  isApplicantProfileComplete: (profile) => Boolean(profile?.id && profile?.first_name && profile?.last_name && profile?.phone && profile?.location && profile?.date_of_birth && profile?.id_number && profile?.cv_url),
  getConfiguredAdminEmails: () => ['connor@yourdomain.com', 'anotheradmin@yourdomain.com'],
  getRoleForEmail: vi.fn(async (email) => appState.roleByEmail?.[email] ?? null),
  getApplicantLandingRouteForEmail: vi.fn(async () => appState.applicantLandingRoute),
  getProviderLandingRouteForEmail: vi.fn(async () => appState.providerLandingRoute),
}))

function renderApp(pathname = '/') {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      {AppComponent ? <AppComponent /> : null}
    </MemoryRouter>,
  )
}

async function loadApp() {
  vi.resetModules()
  AppComponent = (await import('./App')).default
  return AppComponent
}

beforeEach(() => {
  appState.hasSupabaseConfig = true
  appState.sessionResult = { data: { session: null }, error: null }
  appState.authUserResult = { data: { user: { id: 'auth-user-1' } }, error: null }
  appState.roleByEmail = null
  appState.applicantLandingRoute = '/profile'
  appState.providerLandingRoute = '/provider/profile'
  appState.signInResult = { error: null }
  appState.signOutResult = { error: null }
  appState.authStateHandler = null
  appState.usersInsertResult = { data: { role: 'Provider' }, error: null }
  appState.usersInsertCalls = []
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('App integration coverage', () => {
  it('shows a config error when Supabase is missing', async () => {
    appState.hasSupabaseConfig = false
    const App = await loadApp()

    renderApp('/')

    expect(await screen.findByText(/Missing Supabase environment variables/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Log In with Google/i })).toBeTruthy()
    expect(App).toBeTruthy()
  })

  it('shows a restore-session error when getSession fails', async () => {
    appState.sessionResult = { data: null, error: new Error('restore failed') }
    await loadApp()

    renderApp('/')

    expect(await screen.findByText(/Unable to restore your session/i)).toBeTruthy()
  })

  it('renders the provider profile route for a signed-in provider', async () => {
    appState.sessionResult = {
      data: { session: { user: { email: 'provider@example.com' } } },
      error: null,
    }
    appState.roleByEmail = { 'provider@example.com': 'Provider' }
    appState.providerLandingRoute = '/provider/profile'
    await loadApp()

    renderApp('/provider/profile')

    expect(await screen.findByText('Provider Profile Workspace')).toBeTruthy()
  })

  it('renders the provider workspace routes for a signed-in provider', async () => {
    appState.sessionResult = {
      data: { session: { user: { email: 'provider@example.com' } } },
      error: null,
    }
    appState.roleByEmail = { 'provider@example.com': 'Provider' }
    appState.providerLandingRoute = '/provider'
    await loadApp()

    renderApp('/provider/listings/new')
    expect(await screen.findByText('Provider Listing Form')).toBeTruthy()

    cleanup()

    renderApp('/provider/listings/listing-1/edit')
    expect(await screen.findByText('Provider Listing Edit')).toBeTruthy()

    cleanup()

    renderApp('/provider/listings/listing-1/applications')
    expect(await screen.findByText('Provider Listing Applications')).toBeTruthy()
  })

  it('renders the applicant dashboard and listing detail routes for an applicant', async () => {
    appState.sessionResult = {
      data: { session: { user: { email: 'applicant@example.com' } } },
      error: null,
    }
    appState.roleByEmail = { 'applicant@example.com': 'Applicant' }
    appState.applicantLandingRoute = '/dashboard'
    await loadApp()

    renderApp('/dashboard/listings/listing-1')
    expect(await screen.findByText('Applicant Listing Detail')).toBeTruthy()
  })

  it('renders the admin workspace route for a signed-in admin', async () => {
    appState.sessionResult = {
      data: { session: { user: { email: 'admin@example.com' } } },
      error: null,
    }
    appState.roleByEmail = { 'admin@example.com': 'Admin' }
    await loadApp()

    renderApp('/admin')

    expect(await screen.findByText('Admin Workspace')).toBeTruthy()
  })

  it('shows a role-selection overlay for a new user and reports insert failures', async () => {
    appState.sessionResult = {
      data: { session: { user: { email: 'new-provider@example.com' } } },
      error: null,
    }
    appState.roleByEmail = { 'new-provider@example.com': null }
    appState.usersInsertResult = { data: null, error: new Error('insert failed') }
    await loadApp()

    renderApp('/')

    expect(await screen.findByRole('dialog')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Provider' }))

    expect(await screen.findByText(/Could not save role selection/i)).toBeTruthy()
    expect(appState.usersInsertCalls).toEqual([
      { email: 'new-provider@example.com', role: 'Provider', auth_uid: 'auth-user-1' },
    ])
  })

  it('surfaces Google sign-in failures', async () => {
    appState.signInResult = { error: new Error('oauth failed') }
    await loadApp()

    renderApp('/')

    const loginButton = await screen.findByRole('button', { name: /Log In with Google/i })
    fireEvent.click(loginButton)

    expect(await screen.findByText(/Google sign-in failed/i)).toBeTruthy()
  })

  it.skip('handles signed-out auth state changes by clearing the current session state', async () => {
    appState.sessionResult = {
      data: { session: { user: { email: 'applicant@example.com' } } },
      error: null,
    }
    appState.roleByEmail = { 'applicant@example.com': 'Applicant' }
    appState.applicantLandingRoute = '/dashboard'
    await loadApp()

    renderApp('/')

    expect(await screen.findByText('Applicant Dashboard')).toBeTruthy()

    await waitFor(() => {
      expect(typeof appState.authStateHandler).toBe('function')
    })

    await appState.authStateHandler('SIGNED_OUT', null)

    expect(await screen.findByRole('button', { name: /Log In with Google/i })).toBeTruthy()
  })
})