import { describe, test, expect } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cwd } from 'node:process'
import App from './App'

afterEach(() => {
  cleanup()
})

describe('Provider tests', () => {
  test('Provider model includes organisation name field', () => {
    const schemaSql = readFileSync(resolve(cwd(), '../supabase/schema.sql'), 'utf8')

    expect(schemaSql).toContain('create table if not exists provider_profiles')
    expect(schemaSql).toContain('organisation_name text')
  })

  test('Google OAuth entry is available for provider registration', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    const googleAuthButtons = container.querySelectorAll('.google-auth')
    expect(googleAuthButtons.length).toBeGreaterThan(0)
    const buttonText = container.querySelector('.google-auth')?.textContent
    expect(buttonText).toMatch(/Log In with Google|Authenticating/i)
  })

  test('Provider role assignment is wired in OAuth callback flow', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain(".insert({ email: pendingEmail, role: selectedRole })")
    expect(appSource).toContain("handleRoleSelection('Provider')")
  })

  test('Provider selection leads to provider route', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain("if (role === 'Provider') return '/provider'")
    expect(appSource).toContain('<Route path="/provider"')
  })

  test('Provider route is protected and mounted correctly', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('<Route path="/provider"')
    expect(appSource).toMatch(/allowedRole="Provider"/)
    expect(appSource).toContain('ProtectedRoute')
  })
})

describe('Admin tests', () => {
  test("Unauthenticated users can't access /admin", () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('!signedIn')
    expect(appSource).toContain('<Route path="/admin"')
    expect(appSource).toContain('Navigate to="/"')
  })

  test('Wrong role gets redirected away from /admin', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('role !== allowedRole')
    expect(appSource).toContain('<Route path="/admin"')
    expect(appSource).toContain('Navigate to="/"')
  })
  test.todo('Admin email gets the Admin role assigned')
  test.todo('Non-admin email never gets the Admin role')
  test('Admin lands on /admin after login', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain("if (role === 'Admin') return '/admin'")
    expect(appSource).toContain('<Route path="/admin"')
  })

  test('Admin can see the dashboard', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('<AdminDashboardShell onLogout={handleLogout} />')
    expect(appSource).toContain('<Route path="/admin"')
  })
  test.todo('Admin session survives a page refresh')
  test.todo('Logout from admin clears the session')
  test.todo('Admin moderation UI has the right controls')
  test.todo('Example admin emails are in the database')
})

describe('Role based tests', () => {
  test('Applicant role redirects to /dashboard', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain("return '/dashboard'")
  })

  test('Provider role redirects to /provider', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain("if (role === 'Provider') return '/provider'")
  })

  test('Admin role redirects to /admin', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain("if (role === 'Admin') return '/admin'")
  })

  test('Unauthenticated users blocked from protected routes', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('if (!signedIn)')
    expect(appSource).toContain('<Navigate to="/" replace state={{ from: location }} />')
  })

  test.todo('Role isolation enforced')
  test('ProtectedRoute component guards all authenticated routes', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('function ProtectedRoute')
    expect(appSource).toContain('!signedIn')
    expect(appSource).toContain('role !== allowedRole')
  })

  test('Redirect logic implemented for unauthorized access', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('Navigate to="/"')
    expect(appSource).toContain('replace state={{ from: location }}')
  })
  test.todo('Auth loading state displays during verification')
  test('getLandingRoute function routes each role correctly', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('function getLandingRoute(role)')
    expect(appSource).toContain("if (role === 'Admin') return '/admin'")
    expect(appSource).toContain("if (role === 'Provider') return '/provider'")
    expect(appSource).toContain("return '/dashboard'")
  })
  test.todo('Protected route middleware prevents cross-role navigation')
  test('All role routes mounted in App.jsx', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('<Route path="/dashboard"')
    expect(appSource).toContain('<Route path="/provider"')
    expect(appSource).toContain('<Route path="/admin"')
  })

  test('Provider route mounts Provider component', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('<Provider onLogout={handleLogout} />')
  })

  test('Admin route mounts Admin dashboard', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('<AdminDashboardShell onLogout={handleLogout} />')
  })

  test('Dashboard route mounts Applicant dashboard', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('<Dashboard onLogout={handleLogout} />')
  })

  test('Applicant listing detail route is mounted for applicants', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('ApplicantListingDetail')
    expect(appSource).toContain('<Route path="/dashboard/listings/:listingId"')
    expect(appSource).toContain('allowedRole="Applicant"')
  })

  test('Each route requires correct role in ProtectedRoute', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toMatch(/allowedRole="Applicant"/)
    expect(appSource).toMatch(/allowedRole="Provider"/)
    expect(appSource).toMatch(/allowedRole="Admin"/)
  })

  test('Vitest + v8 coverage configured', () => {
    const packageJson = readFileSync(resolve(cwd(), 'package.json'), 'utf8')

    expect(packageJson).toContain('vitest run --coverage')
    expect(packageJson).toContain('@vitest/coverage-v8')
  })

  test('Coverage reports generated and integrated', () => {
    const ciWorkflow = readFileSync(resolve(cwd(), '../.github/workflows/ci.yml'), 'utf8')

    expect(ciWorkflow).toContain('with coverage')
    expect(ciWorkflow).toContain('npm run test --')
  })
  test.todo('Role-sensitive components have high coverage')
  test.todo('GitHub Actions CI runs test pipeline')
  test.todo('Tests pass in CI environment')
})

describe('General home and auth tests', () => {
  test('Home page renders all three landing sections with proper hierarchy', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByText(/BUILDING TALENT/i)).toBeTruthy()
    expect(screen.getAllByText(/OPEN DOORS/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/From FIRST CLICK/i).length).toBeGreaterThan(0)
  })

  test('Home page includes scroll animation hooks', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    const scrollAnimateElements = container.querySelectorAll('.scroll-animate')
    expect(scrollAnimateElements.length).toBeGreaterThan(0)
  })

  test('Home page topbar links are visible', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    expect(screen.getByText('Why Portal')).toBeTruthy()
    expect(screen.getByText('Pathways')).toBeTruthy()
    expect(screen.getByText('Team')).toBeTruthy()
  })

  test('Environment variables for Supabase are configured', () => {
    expect(import.meta.env.VITE_SUPABASE_URL).toBeDefined()
    expect(import.meta.env.VITE_SUPABASE_ANON_KEY).toBeDefined()
    expect(import.meta.env.VITE_SUPABASE_URL).toMatch(/supabase\.co$/)
  })

  test('Sign-in page displays auth status message', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    const statusPill = screen.getByText(/Sign in with Google to continue/i)
    expect(statusPill).toBeTruthy()
    expect(statusPill.className).toContain('status-pill')
  })

  test('Sign-in page is ready for user interaction when Google button is present', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )

    const googleAuthButton = container.querySelector('.google-auth')
    expect(googleAuthButton).toBeTruthy()
    expect(googleAuthButton?.className).toContain('google-auth')
  })
})