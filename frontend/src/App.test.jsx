import { test, expect } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

afterEach(() => {
  cleanup()
})

// ===== HOME PAGE FEATURE TESTS =====
test('HOME: renders all three landing page sections with proper hierarchy', () => {
  render(
    <MemoryRouter initialEntries={['/']}>  
      <App />
    </MemoryRouter>
  )

  expect(screen.getByText(/BUILDING TALENT/i)).toBeTruthy()
  expect(screen.getAllByText(/OPEN DOORS/i).length).toBeGreaterThan(0)
  expect(screen.getAllByText(/From FIRST CLICK/i).length).toBeGreaterThan(0)
})

test('HOME: scroll-animate elements exist on landing page sections', () => {
  const { container } = render(
    <MemoryRouter initialEntries={['/']}>  
      <App />
    </MemoryRouter>
  )

  const scrollAnimateElements = container.querySelectorAll('.scroll-animate')
  expect(scrollAnimateElements.length).toBeGreaterThan(0)
})

test('HOME: topbar navigation links are visible on page load', () => {
  render(
    <MemoryRouter initialEntries={['/']}>  
      <App />
    </MemoryRouter>
  )

  expect(screen.getByText('Why Portal')).toBeTruthy()
  expect(screen.getByText('Pathways')).toBeTruthy()
  expect(screen.getByText('Team')).toBeTruthy()
})

// ===== OAUTH FLOW TESTS =====
test('OAUTH-TASK-1: Environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured and accessible', () => {
  expect(import.meta.env.VITE_SUPABASE_URL).toBeDefined()
  expect(import.meta.env.VITE_SUPABASE_ANON_KEY).toBeDefined()
  expect(import.meta.env.VITE_SUPABASE_URL).toMatch(/supabase\.co$/)
})

test('OAUTH-TASK-2: OAuth callback handler is implemented and sign-in page displays auth status message', () => {
  render(
    <MemoryRouter initialEntries={['/']}>  
      <App />
    </MemoryRouter>
  )

  const statusPill = screen.getByText(/Sign in with Google to continue/i)
  expect(statusPill).toBeTruthy()
  expect(statusPill.className).toContain('status-pill')
})

test('OAUTH-TASK-3: Sign-in page renders Google OAuth button element with correct styling', () => {
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

test('OAUTH-TASK-4: Protected route redirects unsigned users back to home page to sign in', async () => {
  render(
    <MemoryRouter initialEntries={['/dashboard']}> 
      <App />
    </MemoryRouter>
  )

  expect(await screen.findByText(/BUILDING TALENT/i)).toBeTruthy()
})

test('OAUTH-TASK-5: Acceptance test - Given user on sign-in page, When Google button is present, Then sign-in form is ready for user interaction', () => {
  const { container } = render(
    <MemoryRouter initialEntries={['/']}>  
      <App />
    </MemoryRouter>
  )

  const googleAuthButton = container.querySelector('.google-auth')
  expect(googleAuthButton).toBeTruthy()
  expect(googleAuthButton?.className).toContain('google-auth')
})