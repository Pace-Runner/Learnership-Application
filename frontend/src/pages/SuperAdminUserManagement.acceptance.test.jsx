import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Admin from './Admin'

const { mockOrderUsers, mockUpdateUserRole } = vi.hoisted(() => ({
  mockOrderUsers: vi.fn(),
  mockUpdateUserRole: vi.fn(),
}))

vi.mock('../lib/supabaseClient', () => ({
  hasSupabaseConfig: true,
  supabase: {
    from: vi.fn((table) => {
      if (table !== 'users') {
        return {
          select: vi.fn(() => ({
            order: vi.fn(async () => ({ data: [], error: null })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null })),
          })),
        }
      }

      return {
        select: vi.fn(() => ({
          order: mockOrderUsers,
        })),
        update: vi.fn((payload) => ({
          eq: (field, value) => mockUpdateUserRole(payload, field, value),
        })),
      }
    }),
  },
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('SUPER-ADMIN-ACCEPTANCE: user management panel', () => {
  let usersInDatabase

  beforeEach(() => {
    usersInDatabase = [
      { id: 'u-1', email: 'alice@gmail.com', role: 'Applicant', created_at: '2026-01-01T00:00:00Z' },
      { id: 'u-2', email: 'bob@gmail.com', role: 'Admin', created_at: '2026-01-02T00:00:00Z' },
      { id: 'u-3', email: 'sadmin@gmail.com', role: 'SuperAdmin', created_at: '2026-01-03T00:00:00Z' },
    ]

    mockOrderUsers.mockImplementation(async () => ({ data: usersInDatabase, error: null }))
    mockUpdateUserRole.mockImplementation(async (payload, field, value) => {
      if (field !== 'id') {
        return { error: { message: 'Unexpected query' } }
      }

      usersInDatabase = usersInDatabase.map((user) =>
        user.id === value ? { ...user, role: payload.role } : user,
      )

      return { error: null }
    })
  })

  test('shows user management only for SuperAdmin and supports Gmail search, promote, and demote', async () => {
    render(
      <Admin
        onLogout={vi.fn()}
        listings={[]}
        reportApplications={[]}
        userRole="SuperAdmin"
        isAuthenticated={true}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /find users to promote/i }))

    await waitFor(() => {
      expect(screen.getByText('alice@gmail.com')).toBeTruthy()
      expect(screen.getByText('bob@gmail.com')).toBeTruthy()
    })

    fireEvent.change(screen.getByLabelText(/search gmail/i), {
      target: { value: 'alice@gmail.com' },
    })

    expect(screen.getByText('alice@gmail.com')).toBeTruthy()
    expect(screen.queryByText('bob@gmail.com')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /promote to admin/i }))

    await waitFor(() => {
      expect(screen.getByText(/Promoted alice@gmail.com to admin/i)).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: /view current admins to demote/i }))

    await waitFor(() => {
      expect(screen.getByText('alice@gmail.com')).toBeTruthy()
    })

    const aliceCard = screen.getByRole('heading', { name: 'alice@gmail.com' }).closest('section')
    expect(aliceCard).toBeTruthy()
    fireEvent.click(within(aliceCard).getByRole('button', { name: /demote from admin/i }))

    await waitFor(() => {
      expect(screen.getByText(/Demoted alice@gmail.com to applicant/i)).toBeTruthy()
    })
  })

  test('does not render super admin user management for regular Admin users', () => {
    render(
      <Admin
        onLogout={vi.fn()}
        listings={[]}
        reportApplications={[]}
        userRole="Admin"
        isAuthenticated={true}
      />,
    )

    expect(screen.queryByText(/Super Admin User Management/i)).toBeNull()
  })
})
