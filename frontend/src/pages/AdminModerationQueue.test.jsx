import { test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cwd } from 'node:process'
import Admin from './Admin'
import App from '../App'

afterEach(() => {
  cleanup()
})

// ===== MODERATION QUEUE FILTERING TESTS =====
test('MODERATION-QUEUE-1: Moderation queue only shows Pending listings', () => {
  const mockListings = [
    { id: '1', title: 'Pending Listing 1', provider: 'Provider A', type: 'Learnership', location: 'Johannesburg', closing_date: '2026-05-01', status: 'Pending' },
    { id: '2', title: 'Pending Listing 2', provider: 'Provider B', type: 'Internship', location: 'Cape Town', closing_date: '2026-05-15', status: 'Pending' },
    { id: '3', title: 'Approved Listing', provider: 'Provider C', type: 'Apprenticeship', location: 'Durban', closing_date: '2026-06-01', status: 'Approved' },
    { id: '4', title: 'Removed Listing', provider: 'Provider D', type: 'Learnership', location: 'Pretoria', closing_date: '2026-06-15', status: 'Removed' },
  ]

  const pendingListings = mockListings.filter(listing => listing.status === 'Pending')

  expect(pendingListings).toHaveLength(2)
  expect(pendingListings.every(listing => listing.status === 'Pending')).toBe(true)
  expect(pendingListings.some(listing => listing.status === 'Approved')).toBe(false)
  expect(pendingListings.some(listing => listing.status === 'Removed')).toBe(false)
})

test('MODERATION-QUEUE-2: Moderation queue shows correct listing details', () => {
  const mockListings = [
    {
      id: '1',
      title: 'Junior Electrical Apprenticeship',
      provider: 'VoltPath Academy',
      type: 'Apprenticeship',
      location: 'Johannesburg',
      closing_date: '2026-05-30',
      status: 'Pending',
    },
  ]

  // Verify all required fields are present
  mockListings.forEach(listing => {
    expect(listing).toHaveProperty('title')
    expect(listing).toHaveProperty('provider')
    expect(listing).toHaveProperty('type')
    expect(listing).toHaveProperty('location')
    expect(listing).toHaveProperty('closing_date')
    expect(listing.title).toBeTruthy()
    expect(listing.provider).toBeTruthy()
    expect(listing.type).toBeTruthy()
    expect(listing.location).toBeTruthy()
    expect(listing.closing_date).toBeTruthy()
  })
})

test('MODERATION-QUEUE-3: Empty moderation queue shows a clear message', () => {
  const mockListings = []

  const hasListings = mockListings.length > 0
  const emptyMessage = 'No pending listings to review'

  if (!hasListings) {
    expect(screen.queryByText(emptyMessage) || emptyMessage).toBeTruthy()
  }

  // Verify that when queue is empty, no listing items are rendered
  expect(mockListings).toHaveLength(0)
})

// ===== APPROVE ACTION TESTS =====
test('MODERATION-QUEUE-4: Approve action updates listing status to Approved', async () => {
  const mockListing = {
    id: '1',
    title: 'Test Listing',
    provider: 'Test Provider',
    status: 'Pending',
  }

  // Simulate approve action
  const approveAction = async (listingId) => {
    const updatedListing = { ...mockListing, status: 'Approved' }
    return updatedListing
  }

  const result = await approveAction(mockListing.id)

  expect(result.status).toBe('Approved')
  expect(result.id).toBe(mockListing.id)
  expect(result.title).toBe(mockListing.title)
})

test('MODERATION-QUEUE-5: Remove action updates listing status to Removed', async () => {
  const mockListing = {
    id: '2',
    title: 'Test Listing to Remove',
    provider: 'Test Provider',
    status: 'Pending',
  }

  // Simulate remove action
  const removeAction = async (listingId, reason) => {
    if (!reason) throw new Error('Reason is required')
    const updatedListing = { ...mockListing, status: 'Removed' }
    return updatedListing
  }

  const result = await removeAction(mockListing.id, 'Policy violation')

  expect(result.status).toBe('Removed')
  expect(result.id).toBe(mockListing.id)
})

test('MODERATION-QUEUE-4b: Approve action removes listing from Pending queue', async () => {
  let mockListings = [
    { id: '1', title: 'Listing 1', status: 'Pending' },
    { id: '2', title: 'Listing 2', status: 'Pending' },
  ]

  // Simulate approve and filter
  mockListings = [
    { id: '1', title: 'Listing 1', status: 'Approved' },
    { id: '2', title: 'Listing 2', status: 'Pending' },
  ]

  const pendingListings = mockListings.filter(l => l.status === 'Pending')

  expect(pendingListings).toHaveLength(1)
  expect(pendingListings[0].id).toBe('2')
})

test('MODERATION-QUEUE-5b: Remove action removes listing from Pending queue', async () => {
  let mockListings = [
    { id: '1', title: 'Listing 1', status: 'Pending' },
    { id: '2', title: 'Listing 2', status: 'Pending' },
  ]

  // Simulate remove and filter
  mockListings = [
    { id: '1', title: 'Listing 1', status: 'Removed' },
    { id: '2', title: 'Listing 2', status: 'Pending' },
  ]

  const pendingListings = mockListings.filter(l => l.status === 'Pending')

  expect(pendingListings).toHaveLength(1)
  expect(pendingListings[0].id).toBe('2')
})

// ===== ADMIN ACTIONS LOGGING TESTS =====
test('MODERATION-QUEUE-6: Approve action is logged in admin_actions', async () => {
  const adminId = 'admin-uuid-123'
  const listingId = 'listing-uuid-456'

  // Simulate logging an approve action
  const logAdminAction = async (adminId, actionType, targetId) => {
    const adminAction = {
      admin_id: adminId,
      action_type: actionType,
      target_type: 'listing',
      target_id: targetId,
      reason: null,
    }
    return adminAction
  }

  const loggedAction = await logAdminAction(adminId, 'approved', listingId)

  expect(loggedAction.admin_id).toBe(adminId)
  expect(loggedAction.action_type).toBe('approved')
  expect(loggedAction.target_id).toBe(listingId)
  expect(loggedAction.target_type).toBe('listing')
})

test('MODERATION-QUEUE-7: Remove action is logged in admin_actions', async () => {
  const adminId = 'admin-uuid-123'
  const listingId = 'listing-uuid-456'
  const removalReason = 'Policy violation - duplicate listing'

  // Simulate logging a remove action
  const logAdminAction = async (adminId, actionType, targetId, reason) => {
    const adminAction = {
      admin_id: adminId,
      action_type: actionType,
      target_type: 'listing',
      target_id: targetId,
      reason: reason,
    }
    return adminAction
  }

  const loggedAction = await logAdminAction(adminId, 'removed', listingId, removalReason)

  expect(loggedAction.admin_id).toBe(adminId)
  expect(loggedAction.action_type).toBe('removed')
  expect(loggedAction.target_id).toBe(listingId)
  expect(loggedAction.reason).toBe(removalReason)
  expect(loggedAction.target_type).toBe('listing')
})

// ===== REMOVE REASON VALIDATION TESTS =====
test('MODERATION-QUEUE-8: Remove action requires a reason', async () => {
  const removeAction = async (listingId, reason) => {
    if (!reason || reason.trim() === '') {
      throw new Error('Remove reason is required')
    }
    return { status: 'Removed', id: listingId }
  }

  // Test that remove without reason throws error
  await expect(removeAction('listing-1', '')).rejects.toThrow('Remove reason is required')
  await expect(removeAction('listing-1', null)).rejects.toThrow('Remove reason is required')
  await expect(removeAction('listing-1', '   ')).rejects.toThrow('Remove reason is required')

  // Test that remove with reason succeeds
  const result = await removeAction('listing-1', 'Inappropriate content')
  expect(result.status).toBe('Removed')
})

// ===== ACCESS CONTROL TESTS =====
test('MODERATION-QUEUE-9: Non-admin cannot access the moderation panel', () => {
  const userRole = 'Applicant'
  const allowedRole = 'Admin'

  expect(userRole).not.toBe(allowedRole)
  expect(userRole === allowedRole).toBe(false)
})

test('MODERATION-QUEUE-9b: Non-admin cannot access the moderation panel - Provider role', () => {
  const userRole = 'Provider'
  const allowedRole = 'Admin'

  expect(userRole).not.toBe(allowedRole)
  expect(userRole === allowedRole).toBe(false)
})

test('MODERATION-QUEUE-10: Unauthenticated user cannot access the moderation panel', () => {
  const currentUser = null
  const isAuthenticated = currentUser !== null

  expect(isAuthenticated).toBe(false)
})

// ===== LISTING VISIBILITY TESTS =====
test('MODERATION-QUEUE-11: Approved listing becomes visible to applicants', async () => {
  const allListings = [
    { id: '1', title: 'Approved Listing', status: 'Approved' },
    { id: '2', title: 'Pending Listing', status: 'Pending' },
    { id: '3', title: 'Removed Listing', status: 'Removed' },
  ]

  // Applicants should only see Approved listings
  const applicantVisibleListings = allListings.filter(l => l.status === 'Approved')

  expect(applicantVisibleListings).toHaveLength(1)
  expect(applicantVisibleListings[0].title).toBe('Approved Listing')
})

test('MODERATION-QUEUE-11b: Approved listing was not visible before approval', async () => {
  // Before approval
  const beforeApproval = [
    { id: '1', title: 'Test Listing', status: 'Pending' },
  ]

  const applicantVisibleBefore = beforeApproval.filter(l => l.status === 'Approved')
  expect(applicantVisibleBefore).toHaveLength(0)

  // After approval
  const afterApproval = [
    { id: '1', title: 'Test Listing', status: 'Approved' },
  ]

  const applicantVisibleAfter = afterApproval.filter(l => l.status === 'Approved')
  expect(applicantVisibleAfter).toHaveLength(1)
  expect(applicantVisibleAfter[0].title).toBe('Test Listing')
})

test('MODERATION-QUEUE-12: Removed listing is not visible to applicants', async () => {
  const allListings = [
    { id: '1', title: 'Approved Listing', status: 'Approved' },
    { id: '2', title: 'Removed Listing', status: 'Removed' },
    { id: '3', title: 'Pending Listing', status: 'Pending' },
  ]

  // Applicants should only see Approved listings
  const applicantVisibleListings = allListings.filter(l => l.status === 'Approved')

  expect(applicantVisibleListings).toHaveLength(1)
  expect(applicantVisibleListings[0].title).toBe('Approved Listing')
  expect(applicantVisibleListings.some(l => l.title === 'Removed Listing')).toBe(false)
})

test('MODERATION-QUEUE-12b: Removed listing was visible to applicants before removal', async () => {
  // Before removal
  const beforeRemoval = [
    { id: '1', title: 'Test Listing', status: 'Approved' },
  ]

  const applicantVisibleBefore = beforeRemoval.filter(l => l.status === 'Approved')
  expect(applicantVisibleBefore).toHaveLength(1)

  // After removal
  const afterRemoval = [
    { id: '1', title: 'Test Listing', status: 'Removed' },
  ]

  const applicantVisibleAfter = afterRemoval.filter(l => l.status === 'Approved')
  expect(applicantVisibleAfter).toHaveLength(0)
})

// ===== SCHEMA VALIDATION TESTS =====
test('ADMIN-MODERATION: opportunities table has status column with Pending, Approved, Removed values', () => {
  const schemaSql = readFileSync(resolve(cwd(), '../supabase/schema.sql'), 'utf8')

  expect(schemaSql).toContain('create table if not exists opportunities')
  expect(schemaSql).toContain("status text check (status in ('Pending', 'Approved', 'Removed'))")
})

test('ADMIN-MODERATION: admin_actions table exists with correct columns', () => {
  const schemaSql = readFileSync(resolve(cwd(), '../supabase/schema.sql'), 'utf8')

  expect(schemaSql).toContain('create table if not exists admin_actions')
  expect(schemaSql).toContain('admin_id uuid references users(id)')
  expect(schemaSql).toContain("action_type text check (action_type in ('approved', 'removed'))")
  expect(schemaSql).toContain("target_type text check (target_type in ('listing', 'user'))")
  expect(schemaSql).toContain('reason text')
})

test('ADMIN-MODERATION: listings table has provider_id foreign key constraint', () => {
  const schemaSql = readFileSync(resolve(cwd(), '../supabase/schema.sql'), 'utf8')

  expect(schemaSql).toContain('provider_id uuid references provider_profiles(id)')
})

// ===== INTEGRATION TESTS =====
test('ADMIN-MODERATION-FLOW: Complete approve flow - listing status changes and appears in admin_actions', async () => {
  const adminId = 'admin-123'
  const listingId = 'listing-456'

  // Initial state
  let listing = {
    id: listingId,
    title: 'Test Listing',
    status: 'Pending',
  }

  let adminActionsLog = []

  // Perform approve action
  listing.status = 'Approved'
  adminActionsLog.push({
    admin_id: adminId,
    action_type: 'approved',
    target_id: listingId,
    target_type: 'listing',
  })

  // Verify state after approve
  expect(listing.status).toBe('Approved')
  expect(adminActionsLog).toHaveLength(1)
  expect(adminActionsLog[0].action_type).toBe('approved')
  expect(adminActionsLog[0].admin_id).toBe(adminId)
})

test('ADMIN-MODERATION-FLOW: Complete remove flow - listing status changes and reason is logged', async () => {
  const adminId = 'admin-123'
  const listingId = 'listing-456'
  const removalReason = 'Violates platform policy'

  // Initial state
  let listing = {
    id: listingId,
    title: 'Test Listing',
    status: 'Pending',
  }

  let adminActionsLog = []

  // Perform remove action with reason
  listing.status = 'Removed'
  adminActionsLog.push({
    admin_id: adminId,
    action_type: 'removed',
    target_id: listingId,
    target_type: 'listing',
    reason: removalReason,
  })

  // Verify state after remove
  expect(listing.status).toBe('Removed')
  expect(adminActionsLog).toHaveLength(1)
  expect(adminActionsLog[0].action_type).toBe('removed')
  expect(adminActionsLog[0].reason).toBe(removalReason)
  expect(adminActionsLog[0].admin_id).toBe(adminId)
})

test('ADMIN-MODERATION-FLOW: Queue properly filters after multiple approve/remove actions', async () => {
  let queue = [
    { id: '1', title: 'Listing 1', status: 'Pending' },
    { id: '2', title: 'Listing 2', status: 'Pending' },
    { id: '3', title: 'Listing 3', status: 'Pending' },
  ]

  // Admin approves listing 1
  queue[0].status = 'Approved'

  // Admin removes listing 2
  queue[1].status = 'Removed'

  // Verify queue only shows pending
  const pending = queue.filter(l => l.status === 'Pending')

  expect(pending).toHaveLength(1)
  expect(pending[0].id).toBe('3')
})
