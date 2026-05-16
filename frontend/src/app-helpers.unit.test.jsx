import { describe, test, expect } from 'vitest'
import {
  getLandingRoute,
  isProviderProfileComplete,
  getProviderLandingRoute,
  isApplicantProfileComplete,
  getConfiguredAdminEmails,
} from './app-helpers'

describe('app-helpers pure functions', () => {
  test('getLandingRoute returns correct paths', () => {
    expect(getLandingRoute('Admin')).toBe('/admin')
    expect(getLandingRoute('Provider')).toBe('/provider')
    expect(getLandingRoute('Applicant')).toBe('/dashboard')
    expect(getLandingRoute(null)).toBe('/dashboard')
  })

  test('isProviderProfileComplete/ getProviderLandingRoute', () => {
    const incomplete = { id: '', organisation_name: '', phone: '', description: '' }
    expect(isProviderProfileComplete(incomplete)).toBe(false)
    expect(getProviderLandingRoute(incomplete)).toBe('/provider/profile')

    const complete = { id: '1', organisation_name: 'X', phone: '012', description: 'desc' }
    expect(isProviderProfileComplete(complete)).toBe(true)
    expect(getProviderLandingRoute(complete)).toBe('/provider')
  })

  test('isApplicantProfileComplete detects required fields', () => {
    const p = { id: '1', first_name: 'A', last_name: 'B', phone: '0', location: 'L', date_of_birth: '1990', id_number: '123', cv_url: 'a.pdf' }
    expect(isApplicantProfileComplete(p)).toBe(true)
    expect(isApplicantProfileComplete({})).toBe(false)
  })

  test('getConfiguredAdminEmails returns default list when not configured', () => {
    const list = getConfiguredAdminEmails()
    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBeGreaterThan(0)
  })
})
