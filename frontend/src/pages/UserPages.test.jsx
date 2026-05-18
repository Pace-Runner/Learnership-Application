import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { afterEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import Dashboard from './Dashboard'
import ApplicantProfile from './ApplicantProfile'

// Use vi.hoisted to handle mock spies at module parse time
const mockSupabaseSpies = vi.hoisted(() => ({
  getUser: vi.fn(),
  profileSelectMaybeSingle: vi.fn(),
  userSelectMaybeSingle: vi.fn(),
  qualificationsOrder: vi.fn(),
  skillTagsOrder: vi.fn(),
  profileStorageList: vi.fn(),
  docsStorageList: vi.fn(),
}))

vi.mock('../lib/supabaseClient', () => {
  return {
    supabase: {
      auth: {
        getUser: mockSupabaseSpies.getUser,
      },
      from: vi.fn((table) => {
        if (table === 'nqf_qualifications') {
          return {
            select: () => ({
              order: mockSupabaseSpies.qualificationsOrder,
            }),
          }
        }
        if (table === 'skill_tags') {
          return {
            select: () => ({
              order: mockSupabaseSpies.skillTagsOrder,
            }),
          }
        }
        if (table === 'applicant_profiles') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: mockSupabaseSpies.profileSelectMaybeSingle,
              }),
            }),
          }
        }
        if (table === 'users') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: mockSupabaseSpies.userSelectMaybeSingle,
              }),
            }),
          }
        }
        // For other tables, return a flexible chain
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: [], error: null }),
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
          delete: () => ({
            eq: async () => ({ error: null }),
          }),
          insert: async () => ({ error: null }),
        }
      }),
      storage: {
        from: vi.fn((bucket) => {
          if (bucket === 'profile-images') {
            return {
              list: mockSupabaseSpies.profileStorageList,
            }
          }
          if (bucket === 'applicant-documents') {
            return {
              list: mockSupabaseSpies.docsStorageList,
            }
          }
          return {
            list: async () => ({ data: [], error: null }),
          }
        }),
      },
    },
    hasSupabaseConfig: true,
  }
})

const mockSupabaseState = {
  userId: 'user-1',
  authEmail: 'test@example.com',
  profile: {
    id: 'profile-1',
    user_id: 'user-1',
    first_name: 'Test',
    last_name: 'User',
    phone: '0825551234',
    location: 'Cape Town',
    date_of_birth: '2001-04-05',
    id_number: '0104055009087',
    cv_url: null,
    about_me: '',
  },
}

const sampleApprovedListings = [
  {
    id: 'approved-1',
    title: 'Business Administration NQF 4',
    description: 'Office support and administration track',
    location: 'Cape Town',
    status: 'Approved',
  },
  {
    id: 'approved-2',
    title: 'Junior IT Support Internship',
    description: 'Desktop support and troubleshooting',
    location: 'Johannesburg',
    status: 'Approved',
  },
]

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  // Set up default mock responses for ApplicantProfile tests
  mockSupabaseSpies.getUser.mockResolvedValue({
    data: { user: { id: mockSupabaseState.userId, email: mockSupabaseState.authEmail } },
    error: null,
  })
  mockSupabaseSpies.userSelectMaybeSingle.mockResolvedValue({
    data: { id: 'db-user-1', user_id: mockSupabaseState.userId },
    error: null,
  })
  mockSupabaseSpies.profileSelectMaybeSingle.mockResolvedValue({
    data: mockSupabaseState.profile,
    error: null,
  })
  mockSupabaseSpies.qualificationsOrder.mockResolvedValue({
    data: [
      { id: 'qual-1', title: 'Business Administration', nqf_level: 4, saqa_id: '12345' },
    ],
    error: null,
  })
  mockSupabaseSpies.skillTagsOrder.mockResolvedValue({
    data: [{ id: 'skill-1', name: 'Communication' }],
    error: null,
  })
  mockSupabaseSpies.profileStorageList.mockResolvedValue({
    data: [],
    error: null,
  })
  mockSupabaseSpies.docsStorageList.mockResolvedValue({
    data: [],
    error: null,
  })
})

describe('Applicant tests', () => {
  test('Applicant workspace renders correctly', () => {
    const onLogout = vi.fn()

    render(
      <MemoryRouter>
        <Dashboard onLogout={onLogout} listings={sampleApprovedListings} />
      </MemoryRouter>
    )

    expect(screen.getByText('Applicant Workspace')).toBeTruthy()
    expect(screen.getByText(/Find the right listings faster/i)).toBeTruthy()
  })

  test('Quick stats display all required metrics', () => {
    const onLogout = vi.fn()
    render(
      <MemoryRouter>
        <Dashboard onLogout={onLogout} listings={sampleApprovedListings} />
      </MemoryRouter>
    )

    expect(screen.getByText('Available listings')).toBeTruthy()
    expect(screen.getByText('Favourited opportunities')).toBeTruthy()
    expect(screen.getByText('Documents uploaded')).toBeTruthy()
  })

  test('Listings section and search controls visible', () => {
    const onLogout = vi.fn()
    render(
      <MemoryRouter>
        <Dashboard onLogout={onLogout} listings={sampleApprovedListings} />
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: 'Current Listings and Internships' })).toBeTruthy()
    expect(screen.getByPlaceholderText('Search by title, location, or sector')).toBeTruthy()
    expect(screen.getByLabelText('Filter listing type')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Search' })).toBeTruthy()
    expect(screen.queryByText('Focus Areas')).toBeNull()
  })

  test('Example listings and profile navigation present', () => {
    const onLogout = vi.fn()
    render(
      <MemoryRouter>
        <Dashboard onLogout={onLogout} listings={sampleApprovedListings} />
      </MemoryRouter>
    )

    expect(screen.getByText('Business Administration NQF 4')).toBeTruthy()
    expect(screen.getByText('Junior IT Support Internship')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Go to My Profile' })).toBeTruthy()
  })

  test('Logout button functional', () => {
    const onLogout = vi.fn()
    render(
      <MemoryRouter>
        <Dashboard onLogout={onLogout} listings={sampleApprovedListings} />
      </MemoryRouter>
    )

    fireEvent.click(screen.getAllByRole('button', { name: /logout/i })[0])
    expect(onLogout).toHaveBeenCalledTimes(1)
  })

  test('Profile page renders with document actions', async () => {
    const onLogout = vi.fn()
    render(
      <MemoryRouter>
        <ApplicantProfile onLogout={onLogout} />
      </MemoryRouter>
    )

    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByText('Profile and documents')).toBeTruthy()
    })
    
    expect(screen.getByText('Profile Picture')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Upload profile picture' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Delete profile picture' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Upload document' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save full profile' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'View all skills' })).toBeTruthy()
    expect(screen.getByLabelText('Search available skills')).toBeTruthy()
  })
})
