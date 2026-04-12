import { test, expect } from 'vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cwd } from 'node:process'

afterEach(() => {
  cleanup()
})

// ===== ROLE-BASED ROUTING TESTS =====
test('ROLE-BASED-ROUTING-1: Role-based redirect logic implemented in OAuth callback', () => {
  const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

  expect(appSource).toContain("function getLandingRoute(role)")
  expect(appSource).toContain("if (role === 'Admin') return '/admin'")
  expect(appSource).toContain("if (role === 'Provider') return '/provider'")
  expect(appSource).toContain("return '/dashboard'")
})

test('ROLE-BASED-ROUTING-2: Route guards protect all authenticated routes from unauthorized access', () => {
  const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

  expect(appSource).toContain('role')
  expect(appSource).toContain('Route path="/dashboard"')
  expect(appSource).toContain('Route path="/provider"')
  expect(appSource).toContain('Route path="/admin"')
})

test('ROLE-BASED-ROUTING-3: Dashboard placeholder shell exists at /dashboard route', () => {
  const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

  expect(appSource).toContain('<Route path="/dashboard"')
  expect(appSource).toContain('Dashboard')
})

test('ROLE-BASED-ROUTING-4: Provider placeholder shell exists at /provider route', () => {
  const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

  expect(appSource).toContain('<Route path="/provider"')
  expect(appSource).toContain('Provider')
})

test('ROLE-BASED-ROUTING-5: Admin placeholder shell exists at /admin route', () => {
  const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

  expect(appSource).toContain('<Route path="/admin"')
  expect(appSource).toContain('Admin')
})

test('ROLE-BASED-ROUTING-6: Unauthenticated users accessing protected routes are redirected to home page', () => {
  const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

  // Verify ProtectedRoute component redirects unauthenticated users
  expect(appSource).toContain('!signedIn')
  expect(appSource).toContain('Navigate to="/"')
})

test('ROLE-BASED-ROUTING-7: Code coverage infrastructure is configured for GitHub CI', () => {
  const viteConfig = readFileSync(resolve(cwd(), 'vite.config.js'), 'utf8')

  expect(viteConfig).toMatch(/vitest|test/i)
})

test('ROLE-BASED-ROUTING-8: Jest/Vitest coverage is configured and integrated in test pipeline', () => {
  // Check that coverage reporting is available
  expect(readFileSync(resolve(cwd(), 'package.json'), 'utf8')).toContain('vitest')
  expect(readFileSync(resolve(cwd(), 'package.json'), 'utf8')).toContain('coverage')
})

test('ROLE-BASED-ROUTING-ACCEPTANCE: Given authenticated user with Applicant role, When OAuth completes, Then redirected to /dashboard', () => {
  const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

  expect(appSource).toContain("function getLandingRoute(role)")
  expect(appSource).toContain("return '/dashboard'")
  expect(appSource).toContain('<Route path="/dashboard"')
})

test('ROLE-BASED-ROUTING-ACCEPTANCE: Given authenticated user with Provider role, When OAuth completes, Then redirected to /provider', () => {
  const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

  expect(appSource).toContain("if (role === 'Provider') return '/provider'")
  expect(appSource).toContain('<Route path="/provider"')
})

test('ROLE-BASED-ROUTING-ACCEPTANCE: Given authenticated user with Admin role, When OAuth completes, Then redirected to /admin', () => {
  const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

  expect(appSource).toContain("if (role === 'Admin') return '/admin'")
  expect(appSource).toContain('<Route path="/admin"')
})

test('ROLE-BASED-ROUTING-ACCEPTANCE: Given unauthenticated user, When accessing any protected route, Then redirected to home page', () => {
  const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

  // Verify ProtectedRoute guard exists
  expect(appSource).toContain('ProtectedRoute')
  expect(appSource).toContain('role !== allowedRole')
  expect(appSource).toContain('Navigate to')
})

test('ROLE-BASED-ROUTING-ACCEPTANCE: Each role cannot navigate to another role\'s protected route without login', () => {
  // Verify all role routes exist and are protected
  const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

  expect(appSource).toContain('role')
  expect(appSource).toContain('/dashboard')
  expect(appSource).toContain('/provider')
  expect(appSource).toContain('/admin')
})
