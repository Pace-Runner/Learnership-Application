import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from './Dashboard'
import ApplicantProfile from './ApplicantProfile'

afterEach(() => {
  cleanup()
})

describe('Applicant tests', () => {
  test('Applicant workspace renders correctly', () => {
    const onLogout = vi.fn()

    render(
      <MemoryRouter>
        <Dashboard onLogout={onLogout} />
      </MemoryRouter>
    )

    expect(screen.getByText('Applicant Workspace')).toBeTruthy()
    expect(screen.getByText(/Find the right listings faster/i)).toBeTruthy()
  })

  test('Quick stats display all required metrics', () => {
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

  test('Listings section and search controls visible', () => {
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

  test('Example listings and profile navigation present', () => {
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

  test('Logout button functional', () => {
    const onLogout = vi.fn()
    render(
      <MemoryRouter>
        <Dashboard onLogout={onLogout} />
      </MemoryRouter>
    )

    fireEvent.click(screen.getAllByRole('button', { name: /logout/i })[0])
    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  test('Profile page renders with document actions', () => {
    const onLogout = vi.fn()
    render(
      <MemoryRouter>
        <ApplicantProfile onLogout={onLogout} />
      </MemoryRouter>
    )

    expect(screen.getByText('Profile and documents')).toBeTruthy()
    expect(screen.getByText('Profile Picture')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Upload profile picture' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete profile picture' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Upload CV' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Upload new document' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save profile description' })).toBeTruthy()
  })
})
