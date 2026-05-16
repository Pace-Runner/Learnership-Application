import { describe, it, expect } from 'vitest'
import {
  getApplicationStatusLabel,
  normalizeApplicationStatus,
  getApplicationStatusClass,
  formatRandAmount,
  formatShortDate,
} from './pages/ProviderListingApplications'

describe('ProviderListingApplications helpers', () => {
  it('maps application statuses to labels and normalizes Received', () => {
    expect(getApplicationStatusLabel('Received')).toBe('Pending')
    expect(getApplicationStatusLabel('Offered')).toBe('Accepted')
    expect(normalizeApplicationStatus('Received')).toBe('Pending')
    expect(normalizeApplicationStatus(null)).toBe('Pending')
  })

  it('returns appropriate CSS classes for statuses', () => {
    expect(getApplicationStatusClass('Offered')).toContain('approved')
    expect(getApplicationStatusClass('Rejected')).toContain('removed')
    expect(getApplicationStatusClass('Shortlisted')).toContain('soft')
    expect(getApplicationStatusClass('Unknown')).toContain('pending')
  })

  it('formats stipend and short dates correctly', () => {
    // Number(null) === 0, so function returns R0; accept that.
    expect(formatRandAmount(null)).toBe('R0')
    expect(formatRandAmount('4500')).toMatch(/^R/) 
    expect(formatShortDate(null)).toBe('Not specified')
    // invalid date should return input string
    expect(formatShortDate('not-a-date')).toBe('not-a-date')
  })
})
