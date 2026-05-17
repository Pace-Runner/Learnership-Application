import { describe, it, expect } from 'vitest'
import {
  formatRandAmount,
  formatShortDate,
  getApplicationStatusLabel,
  getApplicationStatusClass,
  formatApplicationDate,
  formatNotificationDate,
  getNotificationTypeLabel,
  normalizeApplicationRow,
  normalizeApprovedListing,
  filterApprovedListings,
} from './pages/dashboard-helpers'

describe('Dashboard Helpers', () => {
  describe('formatRandAmount', () => {
    it('formats valid numbers', () => {
      expect(formatRandAmount(1000)).toMatch(/^R/)
      expect(formatRandAmount(0)).toMatch(/^R0/)
    })

    it('returns "Not specified" for non-finite values', () => {
      expect(formatRandAmount(NaN)).toBe('Not specified')
      expect(formatRandAmount(Infinity)).toBe('Not specified')
    })

    it('treats null as 0', () => {
      expect(formatRandAmount(null)).toMatch(/^R0/)
    })
  })

  describe('formatShortDate', () => {
    it('returns "Not specified" for null/empty', () => {
      expect(formatShortDate(null)).toBe('Not specified')
      expect(formatShortDate('')).toBe('Not specified')
    })

    it('formats valid ISO dates', () => {
      expect(formatShortDate('2024-01-15')).toMatch(/^\d{1,2}\s\w{3}\s\d{4}$/)
    })

    it('returns original value for invalid dates', () => {
      const invalid = 'not-a-date'
      expect(formatShortDate(invalid)).toBe(invalid)
    })
  })

  describe('getApplicationStatusLabel', () => {
    it('returns label for known statuses', () => {
      expect(getApplicationStatusLabel('Received')).toBe('Pending')
      expect(getApplicationStatusLabel('Shortlisted')).toBe('Reviewed')
    })

    it('returns "Pending" for unknown status', () => {
      expect(getApplicationStatusLabel('Unknown')).toBe('Pending')
    })
  })

  describe('getApplicationStatusClass', () => {
    it('returns correct class for Offered', () => {
      expect(getApplicationStatusClass('Offered')).toBe('status-chip status-chip-approved')
    })

    it('returns correct class for Rejected', () => {
      expect(getApplicationStatusClass('Rejected')).toBe('status-chip status-chip-removed')
    })

    it('returns status-chip-pending for unknown status', () => {
      expect(getApplicationStatusClass('Unknown')).toBe('status-chip status-chip-pending')
    })
  })

  describe('formatApplicationDate', () => {
    it('returns "Not specified" for null/empty', () => {
      expect(formatApplicationDate(null)).toBe('Not specified')
      expect(formatApplicationDate('')).toBe('Not specified')
    })

    it('formats valid dates', () => {
      expect(formatApplicationDate('2024-01-15')).toMatch(/^\d{1,2}\s\w{3}\s\d{4}$/)
    })

    it('returns original value for invalid dates', () => {
      const invalid = 'invalid-date'
      expect(formatApplicationDate(invalid)).toBe(invalid)
    })
  })

  describe('formatNotificationDate', () => {
    it('returns "Not specified" for null/empty', () => {
      expect(formatNotificationDate(null)).toBe('Not specified')
      expect(formatNotificationDate('')).toBe('Not specified')
    })

    it('formats valid dates', () => {
      expect(formatNotificationDate('2024-01-15')).toMatch(/^\d{1,2}\s\w{3}\s\d{4}$/)
    })

    it('returns original value for invalid dates', () => {
      const invalid = 'not-a-date'
      expect(formatNotificationDate(invalid)).toBe(invalid)
    })
  })

  describe('getNotificationTypeLabel', () => {
    it('returns label for application_status type', () => {
      const label = getNotificationTypeLabel('application_status')
      expect(typeof label).toBe('string')
    })

    it('returns a string for unknown type', () => {
      const label = getNotificationTypeLabel('unknown_type')
      expect(typeof label).toBe('string')
    })

    it('handles null/empty type', () => {
      expect(getNotificationTypeLabel(null)).toBe('Notification')
      expect(getNotificationTypeLabel('')).toBe('Notification')
    })
  })

  describe('normalizeApplicationRow', () => {
    it('normalizes application with all fields', () => {
      const row = {
        id: 'app-1',
        opportunity_id: 'listing-1',
        applicant_id: 'user-1',
        status: 'Offered',
        created_at: '2024-01-15',
        opportunities: { title: 'Engineer Role', type: 'Internship', stipend: 5000 },
        applicant_profiles: { first_name: 'John', last_name: 'Doe' },
      }
      const result = normalizeApplicationRow(row)
      expect(result).toHaveProperty('id', 'app-1')
      expect(result).toHaveProperty('listingTitle', 'Engineer Role')
      expect(result).toHaveProperty('applicantName', 'John Doe')
    })

    it('uses fallback values when data missing', () => {
      const row = { id: 'app-1' }
      const result = normalizeApplicationRow(row)
      expect(result).toHaveProperty('id', 'app-1')
      expect(result).toHaveProperty('listingTitle')
      expect(result.applicantName).toBeTruthy()
    })
  })

  describe('normalizeApprovedListing', () => {
    it('normalizes listing with full data', () => {
      const row = {
        id: 'listing-1',
        title: 'Software Engineer',
        type: 'Internship',
        location: 'Cape Town',
        closing_date: '2024-12-31',
        stipend: 5000,
        description: 'Great opportunity',
        provider_profiles: { organisation_name: 'Tech Corp' },
      }
      const result = normalizeApprovedListing(row)
      expect(result).toHaveProperty('id', 'listing-1')
      expect(result).toHaveProperty('title', 'Software Engineer')
      expect(result).toHaveProperty('provider', 'Tech Corp')
    })

    it('provides sensible defaults for missing data', () => {
      const row = { id: 'listing-1' }
      const result = normalizeApprovedListing(row)
      expect(result).toHaveProperty('id', 'listing-1')
      expect(result.title).toBeTruthy()
      expect(result.type).toBeTruthy()
    })
  })

  describe('filterApprovedListings', () => {
    const listings = [
      {
        id: '1',
        title: 'Software Engineer',
        type: 'Internship',
        location: 'Cape Town',
        status: 'Approved',
        description: 'Tech role',
      },
      {
        id: '2',
        title: 'Data Analyst',
        type: 'Apprenticeship',
        location: 'Johannesburg',
        status: 'Approved',
        description: 'Analytics opportunity',
      },
      {
        id: '3',
        title: 'Marketing Role',
        type: 'Learnership',
        location: 'Cape Town',
        status: 'Pending',
        description: 'Marketing position',
      },
    ]

    it('returns all approved listings when search term is empty', () => {
      const result = filterApprovedListings(listings, '', 'All')
      expect(result).toHaveLength(2)
    })

    it('filters by search term in title', () => {
      const result = filterApprovedListings(listings, 'Software', 'All')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('1')
    })

    it('filters by search term in location', () => {
      const result = filterApprovedListings(listings, 'Cape Town', 'All')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('1')
    })

    it('filters by search term in description', () => {
      const result = filterApprovedListings(listings, 'Analytics', 'All')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('2')
    })

    it('filters by listing type', () => {
      const result = filterApprovedListings(listings, '', 'Apprenticeship')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('2')
    })

    it('combines search and type filter', () => {
      const result = filterApprovedListings(listings, 'Cape', 'Internship')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('1')
    })

    it('excludes pending listings regardless of search', () => {
      const result = filterApprovedListings(listings, 'Marketing', 'All')
      expect(result).toHaveLength(0)
    })

    it('excludes removed listings', () => {
      const allListings = [
        ...listings,
        {
          id: '4',
          title: 'Removed Role',
          type: 'Internship',
          status: 'Removed',
        },
      ]
      const result = filterApprovedListings(allListings, '', 'All')
      expect(result).toHaveLength(2)
    })

    it('is case-insensitive for search', () => {
      const result1 = filterApprovedListings(listings, 'software', 'All')
      const result2 = filterApprovedListings(listings, 'SOFTWARE', 'All')
      const result3 = filterApprovedListings(listings, 'SoFtWaRe', 'All')
      expect(result1).toHaveLength(1)
      expect(result2).toHaveLength(1)
      expect(result3).toHaveLength(1)
    })

    it('trims whitespace from search term', () => {
      const result = filterApprovedListings(listings, '  Software  ', 'All')
      expect(result).toHaveLength(1)
    })

    it('handles empty listings array', () => {
      const result = filterApprovedListings([], 'test', 'All')
      expect(result).toHaveLength(0)
    })

    it('handles listings with missing fields', () => {
      const incomplete = [{ id: '1' }]
      const result = filterApprovedListings(incomplete, '', 'All')
      expect(result).toHaveLength(0)
    })

    it('searches across multiple fields simultaneously', () => {
      const result = filterApprovedListings(listings, 'Tech', 'All')
      // Matches "Software Engineer" title (Tech role in description)
      expect(result.length).toBeGreaterThan(0)
    })

    it('handles type filter All correctly', () => {
      const result = filterApprovedListings(listings, '', 'All')
      expect(result).toHaveLength(2)
    })

    it('handles non-matching type filter', () => {
      const result = filterApprovedListings(listings, '', 'NonExistent')
      expect(result).toHaveLength(0)
    })
  })
})
