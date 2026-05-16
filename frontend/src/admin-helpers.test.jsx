import { describe, it, expect } from 'vitest'
import {
  getPendingListings,
  buildAdminActionPayload,
  normalizeListing,
  normalizeDeleteUserRecord,
  buildDeleteStats,
} from './pages/Admin'

describe('Admin Helpers', () => {
  describe('getPendingListings', () => {
    it('returns listings with Pending status', () => {
      const listings = [
        { id: '1', status: 'Pending', title: 'Listing 1' },
        { id: '2', status: 'Approved', title: 'Listing 2' },
        { id: '3', status: 'Pending', title: 'Listing 3' },
      ]
      const result = getPendingListings(listings)
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('1')
      expect(result[1].id).toBe('3')
    })

    it('returns empty array when no pending listings', () => {
      const listings = [
        { id: '1', status: 'Approved', title: 'Listing 1' },
        { id: '2', status: 'Removed', title: 'Listing 2' },
      ]
      const result = getPendingListings(listings)
      expect(result).toHaveLength(0)
    })

    it('returns empty array for empty input', () => {
      const result = getPendingListings([])
      expect(result).toHaveLength(0)
    })

    it('filters out listings without status property', () => {
      const listings = [
        { id: '1', title: 'Listing 1' },
        { id: '2', status: 'Pending', title: 'Listing 2' },
      ]
      const result = getPendingListings(listings)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('2')
    })
  })

  describe('buildAdminActionPayload', () => {
    it('builds payload with required fields', () => {
      const payload = buildAdminActionPayload('admin1', 'approved', 'listing1', 'Good quality')
      expect(payload.admin_id).toBe('admin1')
      expect(payload.action_type).toBe('approved')
      expect(payload.target_type).toBe('listing')
      expect(payload.target_id).toBe('listing1')
      expect(payload.reason).toBe('Good quality')
    })

    it('omits reason when not provided', () => {
      const payload = buildAdminActionPayload('admin1', 'approved', 'listing1', '')
      expect(payload.reason).toBeUndefined()
    })

    it('omits reason when null', () => {
      const payload = buildAdminActionPayload('admin1', 'approved', 'listing1', null)
      expect(payload.reason).toBeUndefined()
    })

    it('includes listingType when provided', () => {
      const payload = buildAdminActionPayload('admin1', 'deleted', 'listing1', 'Violated policy', 'Internship')
      expect(payload.listing_type).toBe('Internship')
    })

    it('omits listingType when not provided', () => {
      const payload = buildAdminActionPayload('admin1', 'deleted', 'listing1', 'Violated policy')
      expect(payload.listing_type).toBeUndefined()
    })

    it('handles removed action type', () => {
      const payload = buildAdminActionPayload('admin2', 'removed', 'listing2', 'Inactive provider')
      expect(payload.action_type).toBe('removed')
      expect(payload.admin_id).toBe('admin2')
    })

    it('sets admin_id to null when not provided', () => {
      const payload = buildAdminActionPayload('', 'approved', 'listing1', 'Good')
      expect(payload.admin_id).toBeNull()
    })
  })

  describe('normalizeListing', () => {
    it('normalizes listing from direct API response', () => {
      const row = {
        id: 'l1',
        title: 'Software Engineer Role',
        type: 'Internship',
        location: 'Cape Town',
        closing_date: '2024-12-31',
        status: 'Pending',
        provider_id: 'p1',
      }
      const result = normalizeListing(row)
      expect(result.id).toBe('l1')
      expect(result.title).toBe('Software Engineer Role')
      expect(result.type).toBe('Internship')
      expect(result.location).toBe('Cape Town')
      expect(result.closingDate).toBe('2024-12-31')
      expect(result.status).toBe('Pending')
    })

    it('uses provider from joined provider_profiles', () => {
      const row = {
        id: 'l1',
        title: 'Listing',
        provider_id: 'p1',
        provider_profiles: {
          organisation_name: 'Acme Corp',
        },
      }
      const result = normalizeListing(row)
      expect(result.provider).toBe('Acme Corp')
    })

    it('uses provider field when present', () => {
      const row = {
        id: 'l1',
        title: 'Listing',
        provider: 'Tech Inc',
      }
      const result = normalizeListing(row)
      expect(result.provider).toBe('Tech Inc')
    })

    it('defaults missing fields to sensible values', () => {
      const row = { id: 'l1' }
      const result = normalizeListing(row)
      expect(result.title).toBe('Untitled opportunity')
      expect(result.type).toBe('Not specified')
      expect(result.location).toBe('Not specified')
      expect(result.closingDate).toBe('Not specified')
      expect(result.provider).toBe('Unknown provider')
    })

    it('handles closingDate from both closing_date and closingDate', () => {
      const row1 = { id: 'l1', closing_date: '2024-12-31' }
      const row2 = { id: 'l2', closingDate: '2024-11-30' }
      expect(normalizeListing(row1).closingDate).toBe('2024-12-31')
      expect(normalizeListing(row2).closingDate).toBe('2024-11-30')
    })
  })

  describe('normalizeDeleteUserRecord', () => {
    it('normalizes applicant user record with profile', () => {
      const userRow = {
        id: 'u1',
        email: 'applicant@test.com',
        created_at: '2024-01-01T00:00:00Z',
        role: 'Applicant',
      }
      const profileRow = {
        id: 'ap1',
        user_id: 'u1',
        first_name: 'John',
        last_name: 'Doe',
        phone: '0721234567',
        location: 'Johannesburg',
        about_me: 'Software developer',
      }
      const result = normalizeDeleteUserRecord(userRow, profileRow, 'Applicant')
      expect(result.id).toBe('u1')
      expect(result.role).toBe('Applicant')
      expect(result.email).toBe('applicant@test.com')
      expect(result.primaryLabel).toBe('John Doe')
      expect(result.secondaryLabel).toContain('applicant@test.com')
      expect(result.secondaryLabel).toContain('0721234567')
    })

    it('normalizes provider user record with profile', () => {
      const userRow = {
        id: 'p1',
        email: 'provider@test.com',
        created_at: '2024-01-01T00:00:00Z',
        role: 'Provider',
      }
      const profileRow = {
        id: 'pp1',
        user_id: 'p1',
        organisation_name: 'Training Academy',
        contact_email: 'contact@academy.com',
        phone: '0861234567',
        description: 'Best in industry',
      }
      const result = normalizeDeleteUserRecord(userRow, profileRow, 'Provider')
      expect(result.id).toBe('p1')
      expect(result.role).toBe('Provider')
      expect(result.primaryLabel).toBe('Training Academy')
      expect(result.secondaryLabel).toContain('contact@academy.com')
      expect(result.secondaryLabel).toContain('0861234567')
    })

    it('defaults to email when profile missing for applicant', () => {
      const userRow = {
        id: 'u1',
        email: 'user@test.com',
        created_at: '2024-01-01T00:00:00Z',
      }
      const result = normalizeDeleteUserRecord(userRow, null, 'Applicant')
      expect(result.primaryLabel).toBe('user@test.com')
      expect(result.email).toBe('user@test.com')
    })

    it('uses userRow email as primaryLabel for applicant when no profile name', () => {
      const userRow = { id: 'u1', email: 'old@test.com' }
      const profileRow = { contact_email: 'new@test.com' }
      const result = normalizeDeleteUserRecord(userRow, profileRow, 'Applicant')
      // For applicant, uses contact_email for userEmail (fallback) but not for primaryLabel
      expect(result.email).toBe('old@test.com')
      expect(result.primaryLabel).toBe('old@test.com')
    })

    it('builds searchIndex with case-insensitive fields', () => {
      const userRow = {
        id: 'u1',
        email: 'John.Doe@Test.com',
        created_at: '2024-01-01T00:00:00Z',
      }
      const profileRow = {
        first_name: 'John',
        last_name: 'Doe',
        phone: '0721234567',
      }
      const result = normalizeDeleteUserRecord(userRow, profileRow, 'Applicant')
      expect(result.searchIndex).toContain('john')
      expect(result.searchIndex).toContain('0721234567')
      expect(result.searchIndex.toLowerCase()).toBe(result.searchIndex)
    })

    it('includes id in searchIndex', () => {
      const userRow = { id: 'unique-user-id-123' }
      const result = normalizeDeleteUserRecord(userRow, null, 'Applicant')
      expect(result.searchIndex).toContain('unique-user-id-123')
    })
  })

  describe('buildDeleteStats', () => {
    it('counts apprenticeships across all admins', () => {
      const deletedListings = [
        { id: 'l1', admin_id: 'admin1', action_type: 'deleted', listing_type: 'Apprenticeship' },
        { id: 'l2', admin_id: 'admin2', action_type: 'deleted', listing_type: 'Apprenticeship' },
        { id: 'l3', admin_id: 'admin1', action_type: 'deleted', listing_type: 'Internship' },
      ]
      const stats = buildDeleteStats(deletedListings, 'admin1')
      expect(stats.all.apprenticeships).toBe(2)
      expect(stats.admin.apprenticeships).toBe(1)
    })

    it('counts internships across all admins', () => {
      const deletedListings = [
        { id: 'l1', admin_id: 'admin1', action_type: 'deleted', listing_type: 'Internship' },
        { id: 'l2', admin_id: 'admin2', action_type: 'deleted', listing_type: 'Internship' },
      ]
      const stats = buildDeleteStats(deletedListings, 'admin1')
      expect(stats.all.internships).toBe(2)
      expect(stats.admin.internships).toBe(1)
    })

    it('counts learnerships across all admins', () => {
      const deletedListings = [
        { id: 'l1', admin_id: 'admin1', action_type: 'deleted', listing_type: 'Learnership' },
        { id: 'l2', admin_id: 'admin2', action_type: 'deleted', listing_type: 'Learnership' },
        { id: 'l3', admin_id: 'admin3', action_type: 'deleted', listing_type: 'Learnership' },
      ]
      const stats = buildDeleteStats(deletedListings, 'admin1')
      expect(stats.all.learnerships).toBe(3)
      expect(stats.admin.learnerships).toBe(1)
    })

    it('handles case-insensitive listing types', () => {
      const deletedListings = [
        { id: 'l1', admin_id: 'admin1', listing_type: 'APPRENTICESHIP' },
        { id: 'l2', admin_id: 'admin1', listing_type: 'apprenticeship' },
        { id: 'l3', admin_id: 'admin1', listing_type: 'ApPrEnTiCeShIp' },
      ]
      const stats = buildDeleteStats(deletedListings, 'admin1')
      expect(stats.all.apprenticeships).toBe(3)
      expect(stats.admin.apprenticeships).toBe(3)
    })

    it('ignores unknown listing types', () => {
      const deletedListings = [
        { id: 'l1', admin_id: 'admin1', listing_type: 'Unknown' },
        { id: 'l2', admin_id: 'admin1', listing_type: null },
        { id: 'l3', admin_id: 'admin1', listing_type: 'Apprenticeship' },
      ]
      const stats = buildDeleteStats(deletedListings, 'admin1')
      expect(stats.all.apprenticeships).toBe(1)
      expect(stats.all.internships).toBe(0)
      expect(stats.all.learnerships).toBe(0)
    })

    it('returns empty stats for empty array', () => {
      const stats = buildDeleteStats([], 'admin1')
      expect(stats.all.apprenticeships).toBe(0)
      expect(stats.all.internships).toBe(0)
      expect(stats.all.learnerships).toBe(0)
      expect(stats.admin.apprenticeships).toBe(0)
      expect(stats.admin.internships).toBe(0)
      expect(stats.admin.learnerships).toBe(0)
    })

    it('returns empty stats for null input', () => {
      const stats = buildDeleteStats(null, 'admin1')
      expect(stats.all.apprenticeships).toBe(0)
      expect(stats.all.internships).toBe(0)
      expect(stats.all.learnerships).toBe(0)
    })

    it('does not count actions where admin_id does not match currentAdminId', () => {
      const deletedListings = [
        { id: 'l1', admin_id: 'admin1', listing_type: 'Apprenticeship' },
        { id: 'l2', admin_id: 'admin2', listing_type: 'Apprenticeship' },
        { id: 'l3', admin_id: 'other', listing_type: 'Apprenticeship' },
      ]
      const stats = buildDeleteStats(deletedListings, 'admin1')
      expect(stats.all.apprenticeships).toBe(3)
      expect(stats.admin.apprenticeships).toBe(1)
    })

    it('handles mixed types correctly', () => {
      const deletedListings = [
        { id: 'l1', admin_id: 'admin1', listing_type: 'Apprenticeship' },
        { id: 'l2', admin_id: 'admin1', listing_type: 'Internship' },
        { id: 'l3', admin_id: 'admin1', listing_type: 'Learnership' },
        { id: 'l4', admin_id: 'admin2', listing_type: 'Apprenticeship' },
      ]
      const stats = buildDeleteStats(deletedListings, 'admin1')
      expect(stats.admin.apprenticeships).toBe(1)
      expect(stats.admin.internships).toBe(1)
      expect(stats.admin.learnerships).toBe(1)
      expect(stats.all.apprenticeships).toBe(2)
      expect(stats.all.internships).toBe(1)
      expect(stats.all.learnerships).toBe(1)
    })

    it('handles type field fallback when listing_type missing', () => {
      const deletedListings = [
        { id: 'l1', admin_id: 'admin1', type: 'Internship' },
        { id: 'l2', admin_id: 'admin1', listing_type: 'Apprenticeship' },
      ]
      const stats = buildDeleteStats(deletedListings, 'admin1')
      expect(stats.all.internships).toBe(1)
      expect(stats.all.apprenticeships).toBe(1)
    })

    it('does not count when currentAdminId is empty string', () => {
      const deletedListings = [
        { id: 'l1', admin_id: '', listing_type: 'Apprenticeship' },
        { id: 'l2', admin_id: '', listing_type: 'Internship' },
      ]
      const stats = buildDeleteStats(deletedListings, '')
      expect(stats.admin.apprenticeships).toBe(0)
      expect(stats.admin.internships).toBe(0)
      expect(stats.all.apprenticeships).toBe(1)
      expect(stats.all.internships).toBe(1)
    })
  })
})
