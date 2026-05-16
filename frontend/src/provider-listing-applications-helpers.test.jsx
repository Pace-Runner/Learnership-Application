import { describe, it, expect } from 'vitest'
import {
  getApplicationStatusLabel,
  normalizeApplicationStatus,
  getApplicationStatusClass,
  formatRandAmount,
  formatShortDate,
} from './pages/ProviderListingApplications'

describe('ProviderListingApplications Helpers', () => {
  describe('getApplicationStatusLabel', () => {
    it('returns "Pending" for Received status', () => {
      expect(getApplicationStatusLabel('Received')).toBe('Pending')
    })

    it('returns "Reviewed" for Shortlisted status', () => {
      expect(getApplicationStatusLabel('Shortlisted')).toBe('Reviewed')
    })

    it('returns "Accepted" for Offered status', () => {
      expect(getApplicationStatusLabel('Offered')).toBe('Accepted')
    })

    it('returns "Rejected" for Rejected status', () => {
      expect(getApplicationStatusLabel('Rejected')).toBe('Rejected')
    })

    it('returns "Pending" for Pending status', () => {
      expect(getApplicationStatusLabel('Pending')).toBe('Pending')
    })

    it('returns "Pending" for unknown status', () => {
      expect(getApplicationStatusLabel('Unknown')).toBe('Pending')
      expect(getApplicationStatusLabel('Invalid')).toBe('Pending')
    })

    it('returns "Pending" for null or empty status', () => {
      expect(getApplicationStatusLabel(null)).toBe('Pending')
      expect(getApplicationStatusLabel('')).toBe('Pending')
      expect(getApplicationStatusLabel(undefined)).toBe('Pending')
    })

    it('is case-sensitive', () => {
      expect(getApplicationStatusLabel('received')).toBe('Pending')
      expect(getApplicationStatusLabel('RECEIVED')).toBe('Pending')
    })
  })

  describe('normalizeApplicationStatus', () => {
    it('converts Received to Pending', () => {
      expect(normalizeApplicationStatus('Received')).toBe('Pending')
    })

    it('returns status unchanged if not Received', () => {
      expect(normalizeApplicationStatus('Pending')).toBe('Pending')
      expect(normalizeApplicationStatus('Shortlisted')).toBe('Shortlisted')
      expect(normalizeApplicationStatus('Offered')).toBe('Offered')
      expect(normalizeApplicationStatus('Rejected')).toBe('Rejected')
    })

    it('returns Pending for null or empty status', () => {
      expect(normalizeApplicationStatus(null)).toBe('Pending')
      expect(normalizeApplicationStatus('')).toBe('Pending')
      expect(normalizeApplicationStatus(undefined)).toBe('Pending')
    })

    it('returns Pending for unknown status', () => {
      expect(normalizeApplicationStatus('Unknown')).toBe('Unknown')
    })

    it('is case-sensitive', () => {
      expect(normalizeApplicationStatus('received')).not.toBe('Pending')
    })
  })

  describe('getApplicationStatusClass', () => {
    it('returns status-chip-approved class for Offered', () => {
      expect(getApplicationStatusClass('Offered')).toBe('status-chip status-chip-approved')
    })

    it('returns status-chip-removed class for Rejected', () => {
      expect(getApplicationStatusClass('Rejected')).toBe('status-chip status-chip-removed')
    })

    it('returns status-chip-soft class for Shortlisted', () => {
      expect(getApplicationStatusClass('Shortlisted')).toBe('status-chip status-chip-soft')
    })

    it('returns status-chip-pending class for Pending', () => {
      expect(getApplicationStatusClass('Pending')).toBe('status-chip status-chip-pending')
    })

    it('returns status-chip-pending class for Received', () => {
      expect(getApplicationStatusClass('Received')).toBe('status-chip status-chip-pending')
    })

    it('returns status-chip-pending class for unknown status', () => {
      expect(getApplicationStatusClass('Unknown')).toBe('status-chip status-chip-pending')
      expect(getApplicationStatusClass('')).toBe('status-chip status-chip-pending')
      expect(getApplicationStatusClass(null)).toBe('status-chip status-chip-pending')
    })

    it('always returns strings with status-chip base class', () => {
      const statuses = ['Offered', 'Rejected', 'Shortlisted', 'Pending', 'Unknown']
      statuses.forEach((status) => {
        expect(getApplicationStatusClass(status)).toContain('status-chip')
      })
    })

    it('is case-sensitive', () => {
      expect(getApplicationStatusClass('offered')).not.toBe('status-chip status-chip-approved')
      expect(getApplicationStatusClass('OFFERED')).not.toBe('status-chip status-chip-approved')
    })
  })

  describe('formatRandAmount', () => {
    it('formats valid numbers with locale-specific separators', () => {
      expect(formatRandAmount(1000)).toMatch(/^R/)
      expect(formatRandAmount(100)).toMatch(/^R/)
    })

    it('returns "Not specified" for non-finite values', () => {
      expect(formatRandAmount('not-a-number')).toBe('Not specified')
      expect(formatRandAmount(undefined)).toBe('Not specified')
      expect(formatRandAmount(NaN)).toBe('Not specified')
      expect(formatRandAmount(Infinity)).toBe('Not specified')
      expect(formatRandAmount(-Infinity)).toBe('Not specified')
    })

    it('treats null as 0 and formats it', () => {
      expect(formatRandAmount(null)).toMatch(/^R0/)
    })

    it('handles string numbers', () => {
      expect(formatRandAmount('1000')).toMatch(/^R/)
      expect(formatRandAmount('50000.50')).toMatch(/^R/)
    })

    it('handles negative values', () => {
      expect(formatRandAmount(-1000)).toMatch(/^R-?/)
    })

    it('always includes R prefix for valid numbers', () => {
      expect(formatRandAmount(0)).toMatch(/^R/)
      expect(formatRandAmount(1)).toMatch(/^R/)
    })
  })

  describe('formatShortDate', () => {
    it('returns "Not specified" for null or empty values', () => {
      expect(formatShortDate(null)).toBe('Not specified')
      expect(formatShortDate('')).toBe('Not specified')
      expect(formatShortDate(undefined)).toBe('Not specified')
    })

    it('formats valid ISO date strings', () => {
      const result = formatShortDate('2024-01-15')
      expect(result).toMatch(/^\d{1,2}\s\w{3}\s\d{4}$/)
    })

    it('formats ISO dates in en-ZA locale', () => {
      const result = formatShortDate('2024-01-15')
      // en-ZA format: day month year
      expect(result).toMatch(/^15\s\w{3}\s2024$/)
    })

    it('returns the value unchanged for invalid dates', () => {
      const invalidDate = 'not-a-date'
      expect(formatShortDate(invalidDate)).toBe(invalidDate)
    })

    it('handles various date formats', () => {
      // JavaScript Date constructor handles multiple formats
      expect(formatShortDate('2024-01-15')).not.toBe('Not specified')
      expect(formatShortDate('01/15/2024')).not.toBe('Not specified')
    })

    it('handles edge dates', () => {
      expect(formatShortDate('2024-12-31')).toMatch(/^\d{1,2}\s\w{3}\s\d{4}$/)
      expect(formatShortDate('2024-01-01')).toMatch(/^01\s\w{3}\s2024$/)
    })

    it('handles leap year dates', () => {
      const result = formatShortDate('2024-02-29')
      expect(result).toMatch(/^\d{1,2}\s\w{3}\s\d{4}$/)
    })

    it('formats timestamps correctly', () => {
      const result = formatShortDate('2024-01-15T10:30:00Z')
      expect(result).toMatch(/^\d{1,2}\s\w{3}\s\d{4}$/)
    })
  })
})
