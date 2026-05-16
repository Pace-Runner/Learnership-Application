import { describe, it, expect } from 'vitest'
import {
  formatRandAmount,
  formatDate,
  isProfileReady,
  getMissingProfileFields,
} from './pages/ApplicantListingDetail'

describe('ApplicantListingDetail Helpers', () => {
  describe('formatRandAmount', () => {
    it('formats valid positive integers with locale-specific separators', () => {
      // en-ZA locale uses non-breaking space as thousands separator and comma as decimal separator
      expect(formatRandAmount(1000)).toMatch(/^R[\s,\d.]+$/)
      expect(formatRandAmount(100)).toMatch(/^R[\s,\d.]+$/)
    })

    it('returns "Not specified" for non-finite values', () => {
      expect(formatRandAmount('not-a-number')).toBe('Not specified')
      expect(formatRandAmount(undefined)).toBe('Not specified')
      expect(formatRandAmount(NaN)).toBe('Not specified')
      expect(formatRandAmount(Infinity)).toBe('Not specified')
      expect(formatRandAmount(-Infinity)).toBe('Not specified')
    })

    it('treats null as 0 and formats it', () => {
      // Number(null) = 0, which is finite, so returns R0
      expect(formatRandAmount(null)).toMatch(/^R0/)
    })

    it('handles string numbers by parsing them', () => {
      // String should be parsed to number and formatted
      expect(formatRandAmount('1000')).toMatch(/^R/)
      expect(formatRandAmount('50000.50')).toMatch(/^R/)
    })

    it('handles negative values', () => {
      expect(formatRandAmount(-1000)).toMatch(/^R-?[\s,\d.]+$/)
    })

    it('handles zero', () => {
      expect(formatRandAmount(0)).toMatch(/^R0/)
    })

    it('always includes R prefix', () => {
      expect(formatRandAmount(100)).toMatch(/^R/)
      expect(formatRandAmount(0)).toMatch(/^R/)
      expect(formatRandAmount(999999)).toMatch(/^R/)
    })
  })

  describe('formatDate', () => {
    it('returns the value when it is provided', () => {
      expect(formatDate('2024-01-15')).toBe('2024-01-15')
      expect(formatDate('31 December 2024')).toBe('31 December 2024')
    })

    it('returns "Not specified" when value is null', () => {
      expect(formatDate(null)).toBe('Not specified')
    })

    it('returns "Not specified" when value is undefined', () => {
      expect(formatDate(undefined)).toBe('Not specified')
    })

    it('returns "Not specified" when value is empty string', () => {
      expect(formatDate('')).toBe('Not specified')
    })

    it('does not validate date format', () => {
      expect(formatDate('invalid-date')).toBe('invalid-date')
      expect(formatDate('2024-13-45')).toBe('2024-13-45')
    })

    it('handles various date formats', () => {
      expect(formatDate('2024/01/15')).toBe('2024/01/15')
      expect(formatDate('15-01-2024')).toBe('15-01-2024')
      expect(formatDate('January 1, 2024')).toBe('January 1, 2024')
    })

    it('handles whitespace-only strings', () => {
      expect(formatDate('   ')).toBe('   ')
    })

    it('handles falsy values', () => {
      // 0 is falsy, so !0 is true, returns "Not specified"
      expect(formatDate(0)).toBe('Not specified')
      expect(formatDate(false)).toBe('Not specified')
    })
  })

  describe('isProfileReady', () => {
    it('returns true when profile has all required fields', () => {
      const profile = {
        id: 'profile-1',
        first_name: 'John',
        last_name: 'Doe',
        phone: '0721234567',
        location: 'Cape Town',
        date_of_birth: '1990-01-15',
        id_number: '9001151234567',
        cv_url: 'https://example.com/cv.pdf',
      }
      expect(isProfileReady(profile)).toBe(true)
    })

    it('returns false when profile is null', () => {
      expect(isProfileReady(null)).toBe(false)
    })

    it('returns false when profile is undefined', () => {
      expect(isProfileReady(undefined)).toBe(false)
    })

    it('returns false when id is missing', () => {
      const profile = {
        first_name: 'John',
        last_name: 'Doe',
        phone: '0721234567',
        location: 'Cape Town',
        date_of_birth: '1990-01-15',
        id_number: '9001151234567',
        cv_url: 'https://example.com/cv.pdf',
      }
      expect(isProfileReady(profile)).toBe(false)
    })

    it('returns false when first_name is missing or empty', () => {
      const profile = {
        id: 'profile-1',
        first_name: '',
        last_name: 'Doe',
        phone: '0721234567',
        location: 'Cape Town',
        date_of_birth: '1990-01-15',
        id_number: '9001151234567',
        cv_url: 'https://example.com/cv.pdf',
      }
      expect(isProfileReady(profile)).toBe(false)
    })

    it('returns false when first_name is whitespace only', () => {
      const profile = {
        id: 'profile-1',
        first_name: '   ',
        last_name: 'Doe',
        phone: '0721234567',
        location: 'Cape Town',
        date_of_birth: '1990-01-15',
        id_number: '9001151234567',
        cv_url: 'https://example.com/cv.pdf',
      }
      expect(isProfileReady(profile)).toBe(false)
    })

    it('returns false when cv_url is missing or empty', () => {
      const profile = {
        id: 'profile-1',
        first_name: 'John',
        last_name: 'Doe',
        phone: '0721234567',
        location: 'Cape Town',
        date_of_birth: '1990-01-15',
        id_number: '9001151234567',
        cv_url: '',
      }
      expect(isProfileReady(profile)).toBe(false)
    })

    it('returns false when any required field is missing', () => {
      const baseProfile = {
        id: 'profile-1',
        first_name: 'John',
        last_name: 'Doe',
        phone: '0721234567',
        location: 'Cape Town',
        date_of_birth: '1990-01-15',
        id_number: '9001151234567',
        cv_url: 'https://example.com/cv.pdf',
      }

      const testMissingField = (fieldName) => {
        const profile = { ...baseProfile }
        delete profile[fieldName]
        expect(isProfileReady(profile)).toBe(false)
      }

      testMissingField('phone')
      testMissingField('location')
      testMissingField('date_of_birth')
      testMissingField('id_number')
    })

    it('handles extra fields in profile', () => {
      const profile = {
        id: 'profile-1',
        first_name: 'John',
        last_name: 'Doe',
        phone: '0721234567',
        location: 'Cape Town',
        date_of_birth: '1990-01-15',
        id_number: '9001151234567',
        cv_url: 'https://example.com/cv.pdf',
        extra_field: 'extra_value',
        another_field: 'another_value',
      }
      expect(isProfileReady(profile)).toBe(true)
    })
  })

  describe('getMissingProfileFields', () => {
    it('returns list of missing fields including profile and cv when profile is null', () => {
      const result = getMissingProfileFields(null)
      expect(result).toEqual(['profile (personal details)', 'CV'])
    })

    it('returns empty array when all fields are present', () => {
      const profile = {
        id: 'profile-1',
        first_name: 'John',
        last_name: 'Doe',
        phone: '0721234567',
        location: 'Cape Town',
        date_of_birth: '1990-01-15',
        id_number: '9001151234567',
        cv_url: 'https://example.com/cv.pdf',
      }
      expect(getMissingProfileFields(profile)).toEqual([])
    })

    it('identifies missing first_name', () => {
      const profile = {
        id: 'profile-1',
        first_name: '',
        last_name: 'Doe',
        phone: '0721234567',
        location: 'Cape Town',
        date_of_birth: '1990-01-15',
        id_number: '9001151234567',
        cv_url: 'https://example.com/cv.pdf',
      }
      expect(getMissingProfileFields(profile)).toContain('First name')
    })

    it('identifies multiple missing fields', () => {
      const profile = {
        id: 'profile-1',
        first_name: '',
        last_name: '',
        phone: '',
        location: 'Cape Town',
        date_of_birth: '1990-01-15',
        id_number: '9001151234567',
        cv_url: '',
      }
      const result = getMissingProfileFields(profile)
      expect(result).toContain('First name')
      expect(result).toContain('Last name')
      expect(result).toContain('Phone number')
      expect(result).toContain('CV')
      expect(result).not.toContain('Location')
    })

    it('treats whitespace-only strings as missing', () => {
      const profile = {
        id: 'profile-1',
        first_name: '   ',
        last_name: '   ',
        phone: '   ',
        location: 'Cape Town',
        date_of_birth: '1990-01-15',
        id_number: '   ',
        cv_url: '   ',
      }
      const result = getMissingProfileFields(profile)
      expect(result).toContain('First name')
      expect(result).toContain('Last name')
      expect(result).toContain('Phone number')
      expect(result).toContain('ID number')
      expect(result).toContain('CV')
    })

    it('identifies when each individual field is missing', () => {
      const baseProfile = {
        id: 'profile-1',
        first_name: 'John',
        last_name: 'Doe',
        phone: '0721234567',
        location: 'Cape Town',
        date_of_birth: '1990-01-15',
        id_number: '9001151234567',
        cv_url: 'https://example.com/cv.pdf',
      }

      const cases = [
        { field: 'first_name', expectedMissing: 'First name' },
        { field: 'last_name', expectedMissing: 'Last name' },
        { field: 'phone', expectedMissing: 'Phone number' },
        { field: 'location', expectedMissing: 'Location' },
        { field: 'date_of_birth', expectedMissing: 'Date of birth' },
        { field: 'id_number', expectedMissing: 'ID number' },
        { field: 'cv_url', expectedMissing: 'CV' },
      ]

      cases.forEach(({ field, expectedMissing }) => {
        const profile = { ...baseProfile, [field]: '' }
        expect(getMissingProfileFields(profile)).toContain(expectedMissing)
      })
    })

    it('identifies missing date_of_birth (falsy check)', () => {
      const profile = {
        id: 'profile-1',
        first_name: 'John',
        last_name: 'Doe',
        phone: '0721234567',
        location: 'Cape Town',
        date_of_birth: null,
        id_number: '9001151234567',
        cv_url: 'https://example.com/cv.pdf',
      }
      expect(getMissingProfileFields(profile)).toContain('Date of birth')
    })

    it('handles profile with undefined fields', () => {
      const profile = {
        id: 'profile-1',
        first_name: undefined,
        last_name: 'Doe',
      }
      const result = getMissingProfileFields(profile)
      expect(result).toContain('First name')
      expect(result.length).toBeGreaterThan(1)
    })
  })
})
