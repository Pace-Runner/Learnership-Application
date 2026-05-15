import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Admin from './Admin'
import Dashboard from './Dashboard'
import { supabase } from '../lib/supabaseClient'

// Mock Supabase client - returns empty data for admin_actions and users queries
vi.mock('../lib/supabaseClient', () => {
  const from = vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: [], error: null }),
    order: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    upsert: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  }))

  return {
    supabase: {
      from,
      functions: {
        invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
      },
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: 'admin@example.com' } },
          error: null,
        }),
      },
    },
    hasSupabaseConfig: true,
  }
})

afterEach(() => {
  cleanup()
})

function renderAdmin(props = {}) {
  const defaultProps = {
    onLogout: vi.fn(),
    listings: [],
    onApproveListing: vi.fn(),
    onRemoveListing: vi.fn(),
    onLogAdminAction: vi.fn(),
    currentAdminId: 'admin-001',
    userRole: 'Admin',
    isAuthenticated: true,
  }

  const merged = { ...defaultProps, ...props }
  return render(<Admin {...merged} />)
}

describe('Admin moderation queue TDD tests', () => {
  test('1. moderation queue only shows Pending listings', () => {
    const listings = [
      { id: 'l-1', title: 'Pending Listing Alpha', provider: 'Provider A', type: 'Learnership', location: 'Cape Town', closingDate: '2026-05-01', status: 'Pending' },
      { id: 'l-2', title: 'Approved Listing Beta', provider: 'Provider B', type: 'Internship', location: 'Johannesburg', closingDate: '2026-05-05', status: 'Approved' },
      { id: 'l-3', title: 'Removed Listing Gamma', provider: 'Provider C', type: 'Apprenticeship', location: 'Durban', closingDate: '2026-05-09', status: 'Removed' },
    ]

    renderAdmin({ listings })

    expect(screen.getByText('Pending Listing Alpha')).toBeTruthy()
    expect(screen.queryByText('Approved Listing Beta')).toBeNull()
    expect(screen.queryByText('Removed Listing Gamma')).toBeNull()
  })

  test('2. moderation queue shows title, provider, type, location, closing date', () => {
    const listings = [
      { id: 'l-10', title: 'Electrical Apprenticeship Cohort', provider: 'VoltPath Academy', type: 'Apprenticeship', location: 'Pretoria', closingDate: '2026-06-01', status: 'Pending' },
    ]

    renderAdmin({ listings })

    const card = screen.getByText('Electrical Apprenticeship Cohort').closest('li')
    expect(card).toBeTruthy()

    const scoped = within(card)
    expect(scoped.getByText('VoltPath Academy')).toBeTruthy()
    expect(scoped.getByText('Apprenticeship')).toBeTruthy()
    expect(scoped.getByText('Pretoria')).toBeTruthy()
    expect(scoped.getByText('2026-06-01')).toBeTruthy()
  })

  test('3. empty moderation queue shows a clear message', () => {
    renderAdmin({ listings: [] })
    expect(screen.getByText(/no pending listings to review/i)).toBeTruthy()
  })

  test('4. approve/remove tab shows the queue, delete tab, and download button', () => {
    renderAdmin({ listings: [] })

    expect(screen.getByRole('tab', { name: /approve\/remove/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /^delete listing$/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /^delete user$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /download.*csv/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: /^delete listing$/i }))

    expect(screen.getByText(/this admin:.*apprenticeships deleted/i)).toBeTruthy()
    expect(screen.getByText(/all admins:.*apprenticeships deleted/i)).toBeTruthy()
    expect(screen.getAllByText(/deleted/i).length).toBeGreaterThan(0)
  })

  test('5. delete stats count apprenticeships, internships, and learnerships', async () => {
    const deletedActions = [
      { id: 'a-1', admin_id: 'admin-001', action_type: 'deleted', target_type: 'listing', target_id: 'l-1', listing_type: 'Apprenticeship' },
      { id: 'a-2', admin_id: 'admin-001', action_type: 'deleted', target_type: 'listing', target_id: 'l-2', listing_type: 'Internship' },
      { id: 'a-3', admin_id: 'admin-002', action_type: 'deleted', target_type: 'listing', target_id: 'l-3', listing_type: 'Learnership' },
    ]

    const deletedListings = [
      { id: 'l-1', type: 'Apprenticeship' },
      { id: 'l-2', type: 'Internship' },
      { id: 'l-3', type: 'Learnership' },
    ]

    supabase.from.mockImplementation((table) => {
      const chain = {
        filters: {},
        updateValues: null,
        select() {
          return chain
        },
        eq(field, value) {
          if (chain.updateValues && table === 'opportunities' && field === 'id') {
            const match = deletedListings.find((item) => item.id === value)
            if (match) {
              match.status = chain.updateValues.status
            }
            return { error: null }
          }

          chain.filters[field] = value
          return chain
        },
        in(field, values) {
          chain.filters[field] = values
          return chain
        },
        order() {
          return chain
        },
        update(values) {
          chain.updateValues = values
          return chain
        },
        insert() {
          return { data: null, error: null }
        },
        maybeSingle() {
          if (table === 'users') {
            return { data: { id: 'admin-001' }, error: null }
          }

          return { data: null, error: null }
        },
        upsert() {
          return chain
        },
      }

      Object.defineProperty(chain, 'data', {
        get() {
          if (table === 'admin_actions') {
            if (chain.filters.admin_id) {
              return deletedActions.filter((action) => action.admin_id === chain.filters.admin_id)
            }

            if (chain.filters.action_type === 'deleted') {
              return deletedActions
            }

            return []
          }

          if (table === 'opportunities') {
            if (Array.isArray(chain.filters.id)) {
              return deletedListings.filter((item) => chain.filters.id.includes(item.id))
            }

            if (chain.filters.status) {
              return deletedListings.filter((item) => (item.status || 'Removed') === chain.filters.status)
            }

            return deletedListings
          }

          return []
        },
      })

      Object.defineProperty(chain, 'error', {
        get() {
          return null
        },
      })

      return chain
    })

    renderAdmin({ listings: undefined })

    fireEvent.click(await screen.findByRole('tab', { name: /^delete listing$/i }))

    expect(await screen.findByText(/this admin:.*apprenticeships deleted/i)).toBeTruthy()
    expect(screen.getByText(/all admins:.*apprenticeships deleted/i)).toBeTruthy()

    const getValue = (label, index) => screen.getAllByText(label)[index].parentElement.querySelector('strong').textContent

  expect(getValue(/this admin:.*apprenticeships deleted/i, 0)).toBe('1')
  expect(getValue(/this admin:.*internships deleted/i, 0)).toBe('1')
  expect(getValue(/this admin:.*learnerships deleted/i, 0)).toBe('0')
  expect(getValue(/all admins:.*apprenticeships deleted/i, 0)).toBe('1')
  expect(getValue(/all admins:.*internships deleted/i, 0)).toBe('1')
  expect(getValue(/all admins:.*learnerships deleted/i, 0)).toBe('1')
  })

  test('6. delete action removes a listing and logs the listing type', async () => {
    const listingsState = [
      {
        id: 'l-del-1',
        title: 'Learner Support Listing',
        provider: 'Provider A',
        type: 'Learnership',
        location: 'Cape Town',
        closingDate: '2026-06-10',
        status: 'Approved',
      },
    ]
    const deletedActions = []

    supabase.from.mockImplementation((table) => {
      const chain = {
        filters: {},
        updateValues: null,
        select() {
          return chain
        },
        eq(field, value) {
          if (chain.updateValues && table === 'opportunities' && field === 'id') {
            const match = listingsState.find((item) => item.id === value)
            if (match) {
              match.status = chain.updateValues.status
            }
            return { error: null }
          }

          chain.filters[field] = value
          return chain
        },
        in(field, values) {
          chain.filters[field] = values
          return chain
        },
        order() {
          return chain
        },
        update(values) {
          chain.updateValues = values
          return chain
        },
        insert(payload) {
          if (table === 'admin_actions') {
            deletedActions.push(payload)
          }

          return { data: null, error: null }
        },
        maybeSingle() {
          if (table === 'users') {
            return { data: { id: 'admin-001' }, error: null }
          }

          return { data: null, error: null }
        },
        upsert() {
          return chain
        },
      }

      Object.defineProperty(chain, 'data', {
        get() {
          if (table === 'admin_actions') {
            return deletedActions
          }

          if (table === 'opportunities') {
            if (Array.isArray(chain.filters.id)) {
              return listingsState.filter((item) => chain.filters.id.includes(item.id))
            }

            if (chain.filters.status) {
              return listingsState.filter((item) => item.status === chain.filters.status)
            }

            return listingsState
          }

          return []
        },
      })

      Object.defineProperty(chain, 'error', {
        get() {
          return null
        },
      })

      return chain
    })

    renderAdmin({ listings: undefined })

    fireEvent.click(await screen.findByRole('tab', { name: /^delete listing$/i }))
    expect(await screen.findByText('Learner Support Listing')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /learner support listing/i }))
    fireEvent.change(screen.getByLabelText(/reason for deletion/i), {
      target: { value: 'No longer active' },
    })
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }))

    expect(supabase.from).toHaveBeenCalledWith('opportunities')
    expect(supabase.from).toHaveBeenCalledWith('admin_actions')
    await waitFor(() => {
      expect(screen.queryByText('Learner Support Listing')).toBeNull()
    })
  })

  test('7. moderation queue can be filtered by type', () => {
    const listings = [
      { id: 'l-50', title: 'Internship Listing', provider: 'Provider 1', type: 'Internship', location: 'Cape Town', closingDate: '2026-08-10', status: 'Pending' },
      { id: 'l-51', title: 'Learnership Listing', provider: 'Provider 2', type: 'Learnership', location: 'Pretoria', closingDate: '2026-08-11', status: 'Pending' },
      { id: 'l-52', title: 'Apprenticeship Listing', provider: 'Provider 3', type: 'Apprenticeship', location: 'Durban', closingDate: '2026-08-12', status: 'Pending' },
    ]

    renderAdmin({ listings })

    expect(screen.getByText('Internship Listing')).toBeTruthy()
    expect(screen.getByText('Learnership Listing')).toBeTruthy()
    expect(screen.getByText('Apprenticeship Listing')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: /^internship$/i }))

    expect(screen.getByText('Internship Listing')).toBeTruthy()
    expect(screen.queryByText('Learnership Listing')).toBeNull()
    expect(screen.queryByText('Apprenticeship Listing')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: /^all$/i }))

    expect(screen.getByText('Learnership Listing')).toBeTruthy()
    expect(screen.getByText('Apprenticeship Listing')).toBeTruthy()
  })

  test('8. approve action updates listing status and removes from queue', () => {
    const onApproveListing = vi.fn()
    const onLogAdminAction = vi.fn()
    const listings = [
      { id: 'l-20', title: 'Pending Listing For Approval', provider: 'Provider X', type: 'Learnership', location: 'Polokwane', closingDate: '2026-06-20', status: 'Pending' },
    ]

    renderAdmin({ listings, onApproveListing, onLogAdminAction })

    // Click listing to show first modal
    fireEvent.click(screen.getByRole('button', { name: /pending listing for approval/i }))
    
    // Click Approve in the first modal
    const firstModal = screen.getByText(/Approve or Remove Listing\?/).closest('section')
    fireEvent.click(within(firstModal).getAllByRole('button', { name: /^approve$/i })[0])
    
    // Enter reason and confirm in second modal
    fireEvent.change(screen.getByLabelText(/approval reason/i), {
      target: { value: 'Meets quality and compliance checks' },
    })
    fireEvent.click(screen.getByRole('button', { name: /confirm approve/i }))

    expect(onApproveListing).toHaveBeenCalledWith('l-20')
    expect(onLogAdminAction).toHaveBeenCalled()
    expect(screen.queryByText('Pending Listing For Approval')).toBeNull()
  })

  test('9. remove action updates listing status and removes from queue', () => {
    const onRemoveListing = vi.fn()
    const onLogAdminAction = vi.fn()
    const listings = [
      { id: 'l-21', title: 'Pending Listing For Removal', provider: 'Provider Y', type: 'Internship', location: 'Bloemfontein', closingDate: '2026-06-21', status: 'Pending' },
    ]

    renderAdmin({ listings, onRemoveListing, onLogAdminAction })

    // Click listing to show first modal
    fireEvent.click(screen.getByRole('button', { name: /pending listing for removal/i }))
    
    // Click Remove in the first modal
    const firstModal = screen.getByText(/Approve or Remove Listing\?/).closest('section')
    fireEvent.click(within(firstModal).getAllByRole('button', { name: /^remove$/i })[0])
    
    // Enter reason and confirm in second modal
    fireEvent.change(screen.getByLabelText(/removal reason/i), {
      target: { value: 'Duplicate listing' },
    })
    fireEvent.click(screen.getByRole('button', { name: /confirm remove/i }))

    expect(onRemoveListing).toHaveBeenCalledWith('l-21', 'Duplicate listing')
    expect(onLogAdminAction).toHaveBeenCalled()
    expect(screen.queryByText('Pending Listing For Removal')).toBeNull()
  })

  test('10. approve action is logged in admin_actions payload', () => {
    const onApproveListing = vi.fn()
    const onLogAdminAction = vi.fn()
    const listings = [
      { id: 'l-30', title: 'Pending Log Approval Listing', provider: 'Provider Z', type: 'Learnership', location: 'Kimberley', closingDate: '2026-07-01', status: 'Pending' },
    ]

    renderAdmin({ listings, currentAdminId: 'admin-900', onApproveListing, onLogAdminAction })

    // Click listing to show first modal
    fireEvent.click(screen.getByRole('button', { name: /pending log approval listing/i }))
    
    // Click Approve in the first modal
    const firstModal = screen.getByText(/Approve or Remove Listing\?/).closest('section')
    fireEvent.click(within(firstModal).getAllByRole('button', { name: /^approve$/i })[0])
    
    // Enter reason and confirm in second modal
    fireEvent.change(screen.getByLabelText(/approval reason/i), {
      target: { value: 'Verified listing content and dates' },
    })
    fireEvent.click(screen.getByRole('button', { name: /confirm approve/i }))

    expect(onLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        admin_id: 'admin-900',
        action_type: 'approved',
        target_type: 'listing',
        target_id: 'l-30',
      }),
    )
  })

  test('11. remove action is logged in admin_actions payload', () => {
    const onRemoveListing = vi.fn()
    const onLogAdminAction = vi.fn()
    const listings = [
      { id: 'l-31', title: 'Pending Log Remove Listing', provider: 'Provider Z2', type: 'Apprenticeship', location: 'Gqeberha', closingDate: '2026-07-03', status: 'Pending' },
    ]

    renderAdmin({ listings, currentAdminId: 'admin-901', onRemoveListing, onLogAdminAction })

    // Click listing to show first modal
    fireEvent.click(screen.getByRole('button', { name: /pending log remove listing/i }))
    
    // Click Remove in the first modal
    const firstModal = screen.getByText(/Approve or Remove Listing\?/).closest('section')
    fireEvent.click(within(firstModal).getAllByRole('button', { name: /^remove$/i })[0])
    
    // Enter reason and confirm in second modal
    fireEvent.change(screen.getByLabelText(/removal reason/i), {
      target: { value: 'Non-compliant content' },
    })
    fireEvent.click(screen.getByRole('button', { name: /confirm remove/i }))

    expect(onLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        admin_id: 'admin-901',
        action_type: 'removed',
        target_type: 'listing',
        target_id: 'l-31',
        reason: 'Non-compliant content',
      }),
    )
  })

  test('12. remove action requires a reason', () => {
    const onRemoveListing = vi.fn()
    const listings = [
      { id: 'l-40', title: 'Needs reason listing', provider: 'Provider Q', type: 'Learnership', location: 'Nelspruit', closingDate: '2026-08-01', status: 'Pending' },
    ]

    renderAdmin({ listings, onRemoveListing })

    // Click listing to show first modal
    fireEvent.click(screen.getByRole('button', { name: /needs reason listing/i }))
    
    // Click Remove in the first modal
    const firstModal = screen.getByText(/Approve or Remove Listing\?/).closest('section')
    fireEvent.click(within(firstModal).getAllByRole('button', { name: /^remove$/i })[0])
    
    // Try to confirm without entering reason
    const confirmButton = screen.getByRole('button', { name: /confirm remove/i })
    expect(confirmButton.disabled).toBe(true) // Should be disabled when no reason
    
    // Enter reason
    fireEvent.change(screen.getByLabelText(/removal reason/i), {
      target: { value: 'Test reason' },
    })
    fireEvent.click(confirmButton)

    expect(onRemoveListing).toHaveBeenCalled()
  })

  test('13. delete user tab loads applicants and providers and calls the delete function', async () => {
    const applicantUsers = [
      { id: 'u-app-1', email: 'applicant1@example.com', role: 'Applicant', created_at: '2026-05-01' },
    ]
    const providerUsers = [
      { id: 'u-prov-1', email: 'provider1@example.com', role: 'Provider', created_at: '2026-05-02' },
    ]
    const applicantProfiles = [
      { id: 'ap-1', user_id: 'u-app-1', first_name: 'Ava', last_name: 'Nkosi', phone: '0721112222', location: 'Cape Town', about_me: 'Ready to learn', created_at: '2026-05-01' },
    ]
    const providerProfiles = [
      { id: 'pp-1', user_id: 'u-prov-1', organisation_name: 'Build Skills Ltd', contact_email: 'hello@buildskills.co.za', phone: '0111234567', description: 'Training partner', created_at: '2026-05-02' },
    ]

    supabase.from.mockImplementation((table) => {
      const chain = {
        filters: {},
        select() {
          return chain
        },
        eq(field, value) {
          chain.filters[field] = value
          return chain
        },
        in(field, values) {
          chain.filters[field] = values
          return chain
        },
        order() {
          return chain
        },
        update() {
          return chain
        },
        insert() {
          return { data: null, error: null }
        },
        maybeSingle() {
          return { data: null, error: null }
        },
        upsert() {
          return chain
        },
      }

      Object.defineProperty(chain, 'data', {
        get() {
          if (table === 'users') {
            if (chain.filters.role === 'Applicant') {
              return applicantUsers
            }

            if (chain.filters.role === 'Provider') {
              return providerUsers
            }

            return []
          }

          if (table === 'applicant_profiles') {
            if (Array.isArray(chain.filters.user_id)) {
              return applicantProfiles.filter((profile) => chain.filters.user_id.includes(profile.user_id))
            }

            return applicantProfiles
          }

          if (table === 'provider_profiles') {
            if (Array.isArray(chain.filters.user_id)) {
              return providerProfiles.filter((profile) => chain.filters.user_id.includes(profile.user_id))
            }

            return providerProfiles
          }

          return []
        },
      })

      Object.defineProperty(chain, 'error', {
        get() {
          return null
        },
      })

      return chain
    })

    renderAdmin({ listings: undefined })

    fireEvent.click(await screen.findByRole('tab', { name: /^delete user$/i }))

    expect(await screen.findByText('Ava Nkosi')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: /^provider$/i }))
    expect(await screen.findByText('Build Skills Ltd')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: /^applicant$/i }))
    fireEvent.click(screen.getByRole('button', { name: /ava nkosi/i }))
    fireEvent.change(screen.getByLabelText(/reason for deletion/i), {
      target: { value: 'Account created in error' },
    })
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }))

    await waitFor(() => {
      expect(supabase.functions.invoke).toHaveBeenCalledWith(
        'delete-user-account',
        expect.objectContaining({
          body: expect.objectContaining({
            userId: 'u-app-1',
            role: 'Applicant',
            reason: 'Account created in error',
          }),
        }),
      )
    })
  })

  test('13. non-admin cannot access moderation panel', () => {
    renderAdmin({ userRole: 'Applicant', isAuthenticated: true })
    expect(screen.queryByText(/moderation queue/i)).toBeNull()
    expect(screen.getByText(/access denied/i)).toBeTruthy()
  })

  test('14. unauthenticated user cannot access moderation panel', () => {
    renderAdmin({ isAuthenticated: false })
    expect(screen.queryByText(/moderation queue/i)).toBeNull()
    expect(screen.getByText(/redirecting to home/i)).toBeTruthy()
  })

  test('15. approved listing becomes visible to applicants', () => {
    const listingsBefore = [{ id: 'a-1', title: 'Applicant Visibility Listing', type: 'Learnership', provider: 'Provider', location: 'Location', closingDate: '2026-05-01', status: 'Pending' }]
    const listingsAfter = [{ id: 'a-1', title: 'Applicant Visibility Listing', type: 'Learnership', provider: 'Provider', location: 'Location', closingDate: '2026-05-01', status: 'Approved' }]

    const onLogout = vi.fn()

    const { rerender } = render(
      <MemoryRouter>
        <Dashboard onLogout={onLogout} listings={listingsBefore} />
      </MemoryRouter>
    )

    expect(screen.queryByText('Applicant Visibility Listing')).toBeNull()

    rerender(
      <MemoryRouter>
        <Dashboard onLogout={onLogout} listings={listingsAfter} />
      </MemoryRouter>
    )

    expect(screen.getByText('Applicant Visibility Listing')).toBeTruthy()
  })

  test('16. removed listing is not visible to applicants', () => {
    const listings = [
      { id: 'a-3', title: 'Approved Applicant Listing', type: 'Learnership', provider: 'Provider', location: 'Location', closingDate: '2026-05-01', status: 'Approved' },
      { id: 'a-2', title: 'Should Not Be Visible To Applicants', type: 'Internship', provider: 'Provider', location: 'Location', closingDate: '2026-05-01', status: 'Removed' },
    ]

    const onLogout = vi.fn()

    render(
      <MemoryRouter>
        <Dashboard onLogout={onLogout} listings={listings} />
      </MemoryRouter>
    )

    expect(screen.getByText('Approved Applicant Listing')).toBeTruthy()
    expect(screen.queryByText('Should Not Be Visible To Applicants')).toBeNull()
  })

  test('17. cancel button in first modal closes the action selection modal', () => {
    const listings = [
      { id: 'test-1', title: 'Test Listing', type: 'Learnership', provider: 'Provider Co', location: 'City', closingDate: '2026-05-01', status: 'Pending' },
    ]

    renderAdmin({ listings })

    // Click on a listing to open first modal
    const listingCard = screen.getByText('Test Listing')
    fireEvent.click(listingCard)

    // Verify first modal is visible
    expect(screen.getByText(/Approve or Remove Listing/i)).toBeTruthy()

    // Click Cancel button in first modal
    const buttons = screen.getAllByRole('button', { name: /^cancel$/i })
    fireEvent.click(buttons[0]) // First cancel button (in first modal)

    // Verify modal is closed
    expect(screen.queryByText(/Approve or Remove Listing/i)).toBeNull()
  })

  test('18. cancel button in second modal closes the reason entry modal', () => {
    const listings = [
      { id: 'test-2', title: 'Test Listing 2', type: 'Learnership', provider: 'Provider Co', location: 'City', closingDate: '2026-05-01', status: 'Pending' },
    ]

    renderAdmin({ listings })

    // Click on listing to open first modal
    const listingCard = screen.getByText('Test Listing 2')
    fireEvent.click(listingCard)

    // Click Approve button to go to second modal
    const firstModal = screen.getByText(/Approve or Remove Listing\?/).closest('section')
    fireEvent.click(within(firstModal).getAllByRole('button', { name: /^approve$/i })[0])

    // Verify second modal is visible and has textarea for reason
    expect(screen.getByText(/Approval Reason/i)).toBeTruthy()

    // Find and click Cancel button in the second modal (by finding it within the second modal)
    const secondModal = screen.getByText(/Approval Reason/i).closest('section')
    const cancelInSecondModal = within(secondModal).getByRole('button', { name: /^cancel$/i })
    fireEvent.click(cancelInSecondModal)

    // Verify second modal is closed
    expect(screen.queryByText(/Approval Reason/i)).toBeNull()
  })

  test('19. clicking outside modal (overlay) closes the modal', () => {
    const listings = [
      { id: 'test-3', title: 'Test Listing 3', type: 'Learnership', provider: 'Provider Co', location: 'City', closingDate: '2026-05-01', status: 'Pending' },
    ]

    renderAdmin({ listings })

    // Click on listing to open first modal
    const listingCard = screen.getByText('Test Listing 3')
    fireEvent.click(listingCard)

    // Verify modal is visible
    const firstModal = screen.getByText(/Approve or Remove Listing\?/).closest('section').closest('section')
    expect(firstModal).toBeTruthy()

    // Click outside the modal (on the overlay)
    fireEvent.click(firstModal.parentElement || firstModal)

    // Verify modal is closed
    expect(screen.queryByText(/Approve or Remove Listing/i)).toBeNull()
  })

  test('20. delete user modal shows permanent deletion warning', async () => {
    const applicantUsers = [
      { id: 'u-app-1', email: 'applicant1@example.com', role: 'Applicant', created_at: '2026-05-01' },
    ]
    const applicantProfiles = [
      { id: 'ap-1', user_id: 'u-app-1', first_name: 'Test', last_name: 'User', phone: '0721112222', location: 'City', about_me: 'Test', created_at: '2026-05-01' },
    ]

    supabase.from.mockImplementation((table) => {
      const chain = {
        filters: {},
        select() {
          return chain
        },
        eq(field, value) {
          chain.filters[field] = value
          return chain
        },
        in(field, values) {
          chain.filters[field] = values
          return chain
        },
        order() {
          return chain
        },
        update() {
          return chain
        },
        insert() {
          return { data: null, error: null }
        },
        maybeSingle() {
          return { data: null, error: null }
        },
        upsert() {
          return chain
        },
      }

      Object.defineProperty(chain, 'data', {
        get() {
          if (table === 'users') {
            if (chain.filters.role === 'Applicant') {
              return applicantUsers
            }
            return []
          }

          if (table === 'applicant_profiles') {
            if (Array.isArray(chain.filters.user_id)) {
              return applicantProfiles.filter((profile) => chain.filters.user_id.includes(profile.user_id))
            }
            return applicantProfiles
          }

          return []
        },
      })

      Object.defineProperty(chain, 'error', {
        get() {
          return null
        },
      })

      return chain
    })

    renderAdmin({})

    // Click Delete User tab
    fireEvent.click(await screen.findByRole('tab', { name: /^delete user$/i }))

    // Find and click on any user button (the modal should appear)
    const userButtons = await screen.findAllByRole('button')
    // Filter to find the one that contains user info (has secondary label with email)
    let userButton
    for (const button of userButtons) {
      const text = button.textContent
      if (text && text.includes('applicant1@example.com')) {
        userButton = button
        break
      }
    }
    
    if (userButton) {
      fireEvent.click(userButton)

      // Verify the deletion confirmation modal appeared and shows the warning
      await waitFor(() => {
        expect(screen.getByText(/Confirm User Deletion/)).toBeTruthy()
        expect(screen.getByText(/⚠️/)).toBeTruthy()
        expect(screen.getByText(/This action is permanent/)).toBeTruthy()
        expect(screen.getByText(/permanently removed from all database tables/)).toBeTruthy()
      })
    }
  })
})
