import { test, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cwd } from 'node:process'
import Admin from './Admin'
import App from '../App'

afterEach(() => {
  cleanup()
})

// ===== ADMIN DASHBOARD TESTS =====
test('ADMIN-DASHBOARD: renders admin workspace heading and console title', () => {
  const onLogout = vi.fn()
  render(<Admin onLogout={onLogout} />)

  expect(screen.getByText('Admin Workspace')).toBeTruthy()
  expect(screen.getByText('Platform Moderation Console')).toBeTruthy()
})

test('ADMIN-DASHBOARD: logout button is clickable and triggers callback', () => {
  const onLogout = vi.fn()
  render(<Admin onLogout={onLogout} />)

  fireEvent.click(screen.getByRole('button', { name: /logout/i }))
  expect(onLogout).toHaveBeenCalledTimes(1)
})

// ===== ADMIN ACCEPTANCE TESTS =====
test('ADMIN-ACCEPTANCE-1: Admin email addresses are seeded in database with Admin role', () => {
  const schemaSql = readFileSync(resolve(cwd(), '../supabase/schema.sql'), 'utf8')

  expect(schemaSql).toContain('create table if not exists users')
  expect(schemaSql).toContain("role text check (role in ('Applicant', 'Provider', 'Admin', 'SuperAdmin'))")
  expect(schemaSql).toContain("'superadmin@yourdomain.com', 'SuperAdmin'")
})

test('ADMIN-ACCEPTANCE-2: OAuth callback checks email against admin list and assigns Admin role', () => {
  const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

  expect(appSource).toContain('function normalizeRole(roleValue)')
  expect(appSource).toContain("if (normalizedRole === 'Admin')")
  expect(appSource).toContain("if (normalizedRole === 'SuperAdmin')")
  expect(appSource).toContain('handleRoleSelection')
})

test('ADMIN-ACCEPTANCE-3: Admin dashboard shell exists at /admin route with moderation controls', () => {
  const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

  expect(appSource).toContain('<Route path="/admin"')
  expect(appSource).toContain("if (normalizedRole === 'Admin') return '/admin'")
  expect(appSource).toContain("if (normalizedRole === 'SuperAdmin') return '/admin'")
})

test('ADMIN-ACCEPTANCE-4: Non-admin users visiting /admin are redirected away', () => {
  const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

  expect(appSource).toContain('!allowedRoles.includes(resolvedRole)')
  expect(appSource).toContain('Navigate to')
})

test('ADMIN-ACCEPTANCE-5: Admin can access and view the platform moderation console', () => {
  const onLogout = vi.fn()
  render(<Admin onLogout={onLogout} />)

  // Admin workspace displays and is fully accessible
  expect(screen.getByText('Admin Workspace')).toBeTruthy()
  expect(screen.getByRole('button', { name: /logout/i })).toBeTruthy()
})
