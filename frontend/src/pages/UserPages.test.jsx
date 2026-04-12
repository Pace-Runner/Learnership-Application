import { test, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from './Dashboard'
import ApplicantProfile from './ApplicantProfile'

afterEach(() => {
  cleanup()
})

// ===== APPLICANT DASHBOARD TESTS =====
test('APPLICANT-DASHBOARD: renders applicant workspace heading and intro text', () => {
  const onLogout = vi.fn()

  render(
    <MemoryRouter>
      <Dashboard onLogout={onLogout} />
    </MemoryRouter>
  )

  expect(screen.getByText('Applicant Workspace')).toBeTruthy()
  expect(screen.getByText(/Find the right listings faster/i)).toBeTruthy()
})

test('APPLICANT-DASHBOARD: displays quick stats cards with correct labels', () => {
  const onLogout = vi.fn()
  render(
    <MemoryRouter>
      <Dashboard onLogout={onLogout} />
    </MemoryRouter>
  )

  expect(screen.getByText('Available listings')).toBeTruthy()
  expect(screen.getByText('Saved opportunities')).toBeTruthy()
  expect(screen.getByText('Documents uploaded')).toBeTruthy()
})

test('APPLICANT-DASHBOARD: renders listings section and search controls', () => {
  const onLogout = vi.fn()
  render(
    <MemoryRouter>
      <Dashboard onLogout={onLogout} />
    </MemoryRouter>
  )

  expect(screen.getByText('Current Listings and Internships')).toBeTruthy()
  expect(screen.getByPlaceholderText('Search by title, location, or sector')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy()
  expect(screen.queryByText('Focus Areas')).toBeNull()
})

test('APPLICANT-DASHBOARD: shows relevant listing examples and profile navigation action', () => {
  const onLogout = vi.fn()
  render(
    <MemoryRouter>
      <Dashboard onLogout={onLogout} />
    </MemoryRouter>
  )

  expect(screen.getByText('Business Administration NQF 4')).toBeTruthy()
  expect(screen.getByText('Junior IT Support Internship')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Go to My Profile' })).toBeTruthy()
})

test('APPLICANT-DASHBOARD: logout button triggers onLogout callback', () => {
  const onLogout = vi.fn()
  render(
    <MemoryRouter>
      <Dashboard onLogout={onLogout} />
    </MemoryRouter>
  )

  fireEvent.click(screen.getAllByRole('button', { name: /logout/i })[0])
  expect(onLogout).toHaveBeenCalledTimes(1)
})

test('APPLICANT-PROFILE: renders avatar, profile details, and document actions', () => {
  const onLogout = vi.fn()
  render(
    <MemoryRouter>
      <ApplicantProfile onLogout={onLogout} />
    </MemoryRouter>
  )

  expect(screen.getByText('Profile and documents')).toBeTruthy()
  expect(screen.getByText('Profile Picture')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Upload profile picture' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'View uploaded CV' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'View certificates' })).toBeTruthy()
})
