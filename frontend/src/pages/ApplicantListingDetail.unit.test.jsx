import { describe, test, expect } from 'vitest'
import { formatRandAmount, formatDate, isProfileReady, getMissingProfileFields } from './ApplicantListingDetail'

describe('ApplicantListingDetail helpers', () => {
  test('formatRandAmount returns Not specified for invalid values', () => {
    expect(formatRandAmount(undefined)).toBe('Not specified')
    expect(formatRandAmount('abc')).toBe('Not specified')
  })

  test('formatRandAmount formats numbers as ZAR', () => {
    const formatted = formatRandAmount(1234)
    expect(formatted.startsWith('R1')).toBe(true)
    expect(formatted).toContain('234')
  })

  test('formatDate returns Not specified for falsy values and returns value otherwise', () => {
    expect(formatDate(null)).toBe('Not specified')
    expect(formatDate('2024-01-01')).toBe('2024-01-01')
  })

  test('isProfileReady detects complete/incomplete profiles', () => {
    const complete = { id: '1', first_name: 'A', last_name: 'B', phone: '0123456789', location: 'City', date_of_birth: '1990-01-01', id_number: '1234567890123', cv_url: 'file.pdf' }
    expect(isProfileReady(complete)).toBe(true)

    const incomplete = { id: '2', first_name: '', last_name: 'B', phone: '', location: '', date_of_birth: '', id_number: '', cv_url: '' }
    expect(isProfileReady(incomplete)).toBe(false)
  })

  test('getMissingProfileFields returns expected missing list', () => {
    expect(getMissingProfileFields(null)).toEqual(['profile (personal details)', 'CV'])

    const p = { first_name: '', last_name: '', phone: '', location: '', date_of_birth: '', id_number: '', cv_url: '' }
    const missing = getMissingProfileFields(p)
    expect(missing).toContain('First name')
    expect(missing).toContain('CV')
  })
})
