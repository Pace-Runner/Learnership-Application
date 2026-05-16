import { test, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cwd } from 'node:process'
import Provider from './Provider'

afterEach(() => {
  cleanup()
})

// ===== PROVIDER DASHBOARD TESTS =====
test('PROVIDER-DASHBOARD: renders provider dashboard heading and welcome message', () => {
  const onLogout = vi.fn()
  render(
    <MemoryRouter>
      <Provider onLogout={onLogout} />
    </MemoryRouter>
  )

  expect(screen.getByText('Provider Workspace')).toBeTruthy()
  expect(screen.getByText(/Manage your learnership pipeline/i)).toBeTruthy()
})

test('PROVIDER-DASHBOARD: renders stats and listing overview', async () => {
  const onLogout = vi.fn()
  render(
    <MemoryRouter>
      <Provider onLogout={onLogout} />
    </MemoryRouter>
  )

  expect(screen.getByRole('button', { name: 'Profile' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'New Listing' })).toBeTruthy()
  expect(screen.getByText('Active listings')).toBeTruthy()
  expect(screen.getByText('Pending approval')).toBeTruthy()
  expect(screen.getByText('Approved listings')).toBeTruthy()
  expect(screen.getByText('Listing overview')).toBeTruthy()
  expect(screen.getByText('Your submitted listings')).toBeTruthy()
  expect(screen.getByText('Loading your listings...')).toBeTruthy()
  expect(screen.getByText('Before you publish')).toBeTruthy()

  expect(await screen.findAllByRole('button', { name: 'View applicants' })).toHaveLength(2)
})

test('PROVIDER-DASHBOARD: logout button is clickable and triggers callback', () => {
  const onLogout = vi.fn()
  render(
    <MemoryRouter>
      <Provider onLogout={onLogout} />
    </MemoryRouter>
  )

  fireEvent.click(screen.getByRole('button', { name: /logout/i }))
  expect(onLogout).toHaveBeenCalledTimes(1)
})

// ===== PROVIDER ACCEPTANCE TESTS =====
test('PROVIDER-ACCEPTANCE-1: Provider model has organisation_name field in schema', () => {
  const schemaSql = readFileSync(resolve(cwd(), '../supabase/schema.sql'), 'utf8')

  expect(schemaSql).toContain('create table if not exists provider_profiles')
  expect(schemaSql).toContain('organisation_name text')
})

test('PROVIDER-ACCEPTANCE-2: Google OAuth entry point exists on registration page', () => {
  const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

  expect(appSource).toContain("signInWithOAuth")
  expect(appSource).toContain("provider: 'google'")
  expect(appSource).toContain("Log In with Google")
})

test('PROVIDER-ACCEPTANCE-3: OAuth callback supports Provider role assignment flow', () => {
  const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

  expect(appSource).toContain(".insert({ email: pendingEmail, role: selectedRole })")
  expect(appSource).toContain("handleRoleSelection('Provider')")
})

test('PROVIDER-ACCEPTANCE-4: Successful Provider login landing route is /provider', () => {
  const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')
  const appHelpersSource = readFileSync(resolve(cwd(), 'src/app-helpers.js'), 'utf8')

  expect(appHelpersSource).toContain("if (role === 'Provider') return '/provider'")
  expect(appSource).toContain('<Route path="/provider"')
})
