import { describe, test, expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import {
  getLandingRoute,
  isProviderProfileComplete,
  getProviderLandingRoute,
  isApplicantProfileComplete,
  getConfiguredAdminEmails,
} from './App'

afterEach(() => {
  cleanup()
})

describe('App helper functions', () => {
  test('getLandingRoute returns expected paths', () => {
    expect(getLandingRoute('Admin')).toBe('/admin')
    expect(getLandingRoute('Provider')).toBe('/provider')
    expect(getLandingRoute('Applicant')).toBe('/dashboard')
    expect(getLandingRoute(null)).toBe('/dashboard')
  })

  test('isProviderProfileComplete detects complete and incomplete profiles', () => {
    const incomplete = { id: 1, organisation_name: '  ', phone: '123' }
    expect(isProviderProfileComplete(incomplete)).toBe(false)

    const complete = {
      id: 2,
      organisation_name: 'Acme Ltd',
      phone: ' 0712345678 ',
      description: 'We hire learners',
    }
    expect(isProviderProfileComplete(complete)).toBe(true)
  })

  test('getProviderLandingRoute returns profile or provider route', () => {
    const incomplete = { id: 1, organisation_name: '', phone: '', description: '' }
    expect(getProviderLandingRoute(incomplete)).toBe('/provider/profile')

    const complete = { id: 3, organisation_name: 'X', phone: '1', description: 'd' }
    expect(getProviderLandingRoute(complete)).toBe('/provider')
  })

  test('isApplicantProfileComplete detects required applicant fields', () => {
    const missing = { id: 1, first_name: 'John', last_name: '', phone: '1' }
    expect(isApplicantProfileComplete(missing)).toBe(false)

    const full = {
      id: 9,
      first_name: 'Jane',
      last_name: 'Doe',
      phone: '071234',
      location: 'City',
      date_of_birth: '1990-01-01',
      id_number: '9001010000',
      cv_url: 'https://example.com/cv.pdf',
    }
    expect(isApplicantProfileComplete(full)).toBe(true)
  })

  test('getConfiguredAdminEmails returns defaults and parses env var', () => {
    // When VITE_ADMIN_EMAILS is not set, we get the default array
    const defaultList = getConfiguredAdminEmails()
    expect(Array.isArray(defaultList)).toBe(true)
    expect(defaultList.length).toBeGreaterThan(0)

    // Temporarily set environment variable and verify parsing
    try {
      import.meta.env.VITE_ADMIN_EMAILS = ' Admin@EXAMPLE.com, second@domain.com '
    } catch (e) {
      // Some runners make import.meta.env read-only; in that case skip the mutating check
    }

    const parsed = getConfiguredAdminEmails()
    expect(parsed).toEqual(
      expect.arrayContaining(['admin@example.com', 'second@domain.com']),
    )
  })
})
