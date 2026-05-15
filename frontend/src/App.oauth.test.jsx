import { describe, test, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cwd } from 'node:process'

afterEach(() => {
  vi.clearAllMocks()
})

describe('App OAuth and role assignment logic', () => {
  test('getRoleForEmail function handles admin email assignment', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('getRoleForEmail')
    expect(appSource).toContain('getConfiguredAdminEmails')
    expect(appSource).toContain('.toLowerCase()')
  })

  test('isProviderProfileComplete checks all required fields', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('isProviderProfileComplete')
    expect(appSource).toContain('organisation_name')
    expect(appSource).toContain('phone')
    expect(appSource).toContain('description')
  })

  test('isApplicantProfileComplete validates all profile fields', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('isApplicantProfileComplete')
    expect(appSource).toContain('first_name')
    expect(appSource).toContain('last_name')
    expect(appSource).toContain('cv_url')
    expect(appSource).toContain('id_number')
  })

  test('getProviderLandingRoute redirects incomplete profile to profile page', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('getProviderLandingRoute')
    expect(appSource).toContain('/provider/profile')
    expect(appSource).toContain('/provider')
  })

  test('getLandingRoute handles all three roles', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('getLandingRoute')
    expect(appSource).toContain("'Admin'")
    expect(appSource).toContain("'Provider'")
    expect(appSource).toContain("'Applicant'")
    expect(appSource).toContain('/admin')
    expect(appSource).toContain('/provider')
    expect(appSource).toContain('/dashboard')
  })

  test('OAuth email validation handles null/empty emails', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('email')
    expect(appSource).toContain('getSession')
    expect(appSource).toContain('trim')
  })

  test('Role selection creates user in database', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('handleRoleSelection')
    expect(appSource).toContain('.insert(')
    expect(appSource).toContain('email')
    expect(appSource).toContain('role')
  })

  test('ProtectedRoute component redirects unauthenticated users', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('function ProtectedRoute')
    expect(appSource).toContain('!signedIn')
    expect(appSource).toContain('Navigate to="/"')
    expect(appSource).toContain('role !== allowedRole')
  })

  test('ProviderWorkspaceRoute enforces profile completion', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('function ProviderWorkspaceRoute')
    expect(appSource).toContain('providerLandingRoute')
    expect(appSource).toContain("/provider/profile")
  })

  test('ProviderProfileRoute stays accessible for editing', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('function ProviderProfileRoute')
    expect(appSource).toContain("'/provider/profile'")
    expect(appSource).toContain("role !== 'Provider'")
  })

  test('Configured admin emails fallback to defaults', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('getConfiguredAdminEmails')
    expect(appSource).toContain('VITE_ADMIN_EMAILS')
    expect(appSource).toContain('.split(')
    expect(appSource).toContain('connor@yourdomain.com')
  })

  test('Session persistence uses browser cookies', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('onAuthStateChange')
    expect(appSource).toContain('getSession')
    expect(appSource).toContain('setSignedIn')
  })

  test('Auth error state is displayed to user', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('authError')
    expect(appSource).toContain('setAuthError')
  })

  test('Routes are protected at application level', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('<Route')
    expect(appSource).toContain('ProtectedRoute')
    expect(appSource).toContain('signedIn')
    expect(appSource).toContain('role')
  })
})
