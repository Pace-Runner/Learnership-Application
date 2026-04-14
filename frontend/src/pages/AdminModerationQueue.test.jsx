import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Admin from './Admin'
import Dashboard from './Dashboard'

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

  return render(<Admin {...defaultProps} {...props} />)
}

describe('Admin moderation queue TDD tests', () => {
  test('1. moderation queue only shows Pending listings', () => {
    const listings = [
      {
        id: 'l-1',
        title: 'Pending Listing Alpha',
        provider: 'Provider A',
        type: 'Learnership',
        location: 'Cape Town',
        closingDate: '2026-05-01',
        status: 'Pending',
      },
      {
        id: 'l-2',
        title: 'Approved Listing Beta',
        provider: 'Provider B',
        type: 'Internship',
        location: 'Johannesburg',
        closingDate: '2026-05-05',
        status: 'Approved',
      },
      {
        id: 'l-3',
        title: 'Removed Listing Gamma',
        provider: 'Provider C',
        type: 'Apprenticeship',
        location: 'Durban',
        closingDate: '2026-05-09',
        status: 'Removed',
      },
    ]

    renderAdmin({ listings })

    expect(screen.getByText('Pending Listing Alpha')).toBeTruthy()
    expect(screen.queryByText('Approved Listing Beta')).toBeNull()
    expect(screen.queryByText('Removed Listing Gamma')).toBeNull()
  })

  test('2. moderation queue shows title, provider, type, location, closing date', () => {
    const listings = [
      {
        id: 'l-10',
        title: 'Electrical Apprenticeship Cohort',
        provider: 'VoltPath Academy',
        type: 'Apprenticeship',
        location: 'Pretoria',
        closingDate: '2026-06-01',
        status: 'Pending',
      },
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

  test('4. approve action updates listing status and removes from queue', () => {
    const onApproveListing = vi.fn()
    const listings = [
      {
        id: 'l-20',
        title: 'Pending Listing For Approval',
        provider: 'Provider X',
        type: 'Learnership',
        location: 'Polokwane',
        closingDate: '2026-06-20',
        status: 'Pending',
      },
    ]

    renderAdmin({ listings, onApproveListing })

    fireEvent.click(screen.getByRole('button', { name: /approve/i }))

    expect(onApproveListing).toHaveBeenCalledWith('l-20')
    expect(screen.queryByText('Pending Listing For Approval')).toBeNull()
  })

  test('5. remove action updates listing status and removes from queue', () => {
    const onRemoveListing = vi.fn()
    const listings = [
      {
        id: 'l-21',
        title: 'Pending Listing For Removal',
        provider: 'Provider Y',
        type: 'Internship',
        location: 'Bloemfontein',
        closingDate: '2026-06-21',
        status: 'Pending',
      },
    ]

    renderAdmin({ listings, onRemoveListing })

    fireEvent.change(screen.getByLabelText(/remove reason/i), {
      target: { value: 'Duplicate listing' },
    })
    fireEvent.click(screen.getByRole('button', { name: /remove/i }))

    expect(onRemoveListing).toHaveBeenCalledWith('l-21', 'Duplicate listing')
    expect(screen.queryByText('Pending Listing For Removal')).toBeNull()
  })

  test('6. approve action is logged in admin_actions payload', () => {
    const onApproveListing = vi.fn()
    const onLogAdminAction = vi.fn()

    const listings = [
      {
        id: 'l-30',
        title: 'Pending Log Approval Listing',
        provider: 'Provider Z',
        type: 'Learnership',
        location: 'Kimberley',
        closingDate: '2026-07-01',
        status: 'Pending',
      },
    ]

    renderAdmin({
      listings,
      currentAdminId: 'admin-900',
      onApproveListing,
      onLogAdminAction,
    })

    fireEvent.click(screen.getByRole('button', { name: /approve/i }))

    expect(onLogAdminAction).toHaveBeenCalledWith({
      admin_id: 'admin-900',
      action_type: 'approved',
      target_type: 'listing',
      target_id: 'l-30',
    })
  })

  test('7. remove action is logged in admin_actions payload', () => {
    const onRemoveListing = vi.fn()
    const onLogAdminAction = vi.fn()

    const listings = [
      {
        id: 'l-31',
        title: 'Pending Log Remove Listing',
        provider: 'Provider Z2',
        type: 'Apprenticeship',
        location: 'Gqeberha',
        closingDate: '2026-07-03',
        status: 'Pending',
      },
    ]

    renderAdmin({
      listings,
      currentAdminId: 'admin-901',
      onRemoveListing,
      onLogAdminAction,
    })

    fireEvent.change(screen.getByLabelText(/remove reason/i), {
      target: { value: 'Non-compliant content' },
    })
    fireEvent.click(screen.getByRole('button', { name: /remove/i }))

    expect(onLogAdminAction).toHaveBeenCalledWith({
      admin_id: 'admin-901',
      action_type: 'removed',
      target_type: 'listing',
      target_id: 'l-31',
      reason: 'Non-compliant content',
    })
  })

  test('8. remove action requires a reason', () => {
    const onRemoveListing = vi.fn()

    const listings = [
      {
        id: 'l-40',
        title: 'Needs reason listing',
        provider: 'Provider Q',
        type: 'Learnership',
        location: 'Nelspruit',
        closingDate: '2026-08-01',
        status: 'Pending',
      },
    ]

    renderAdmin({ listings, onRemoveListing })

    fireEvent.click(screen.getByRole('button', { name: /remove/i }))

    expect(onRemoveListing).not.toHaveBeenCalled()
    expect(screen.getByText(/remove reason is required/i)).toBeTruthy()
  })

  test('9. non-admin cannot access moderation panel', () => {
    renderAdmin({ userRole: 'Applicant', isAuthenticated: true })

    expect(screen.queryByText(/moderation queue/i)).toBeNull()
    expect(screen.getByText(/access denied/i)).toBeTruthy()
  })

  test('10. unauthenticated user cannot access moderation panel', () => {
    renderAdmin({ isAuthenticated: false })

    expect(screen.queryByText(/moderation queue/i)).toBeNull()
    expect(screen.getByText(/redirecting to home/i)).toBeTruthy()
  })

  test('11. approved listing becomes visible to applicants', () => {
    const listingsBefore = [
      {
        id: 'a-1',
        title: 'Applicant Visibility Listing',
        type: 'Learnership',
        status: 'Pending',
      },
    ]

    const listingsAfter = [
      {
        id: 'a-1',
        title: 'Applicant Visibility Listing',
        type: 'Learnership',
        status: 'Approved',
      },
    ]

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

  test('12. removed listing is not visible to applicants', () => {
    const listings = [
      {
        id: 'a-3',
        title: 'Approved Applicant Listing',
        type: 'Learnership',
        status: 'Approved',
      },
      {
        id: 'a-2',
        title: 'Should Not Be Visible To Applicants',
        type: 'Internship',
        status: 'Removed',
      },
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
})
