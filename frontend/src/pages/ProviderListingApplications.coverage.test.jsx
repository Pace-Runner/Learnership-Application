import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ProviderListingApplications from './ProviderListingApplications'

const { mockGetSession, mockFrom, mockStorageFrom, mockInvoke } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockFrom: vi.fn(),
  mockStorageFrom: vi.fn(),
  mockInvoke: vi.fn(),
}))

vi.mock('../lib/supabaseClient', () => ({
  hasSupabaseConfig: true,
  supabase: {
    auth: {
      getSession: mockGetSession,
    },
    from: mockFrom,
    storage: {
      from: mockStorageFrom,
    },
    functions: {
      invoke: mockInvoke,
    },
  },
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function createUsersMock() {
  return {
    select: () => ({
      eq: (field, value) => ({
        maybeSingle: async () => {
          // When querying by id for applicant user (in loadApplicantDetails), return auth_uid
          if (field === 'id' && value === 'applicant-user-1') {
            return { data: { id: 'applicant-user-1', auth_uid: 'applicant-auth-1' }, error: null }
          }
          // Default for provider user lookup
          return { data: { id: 'provider-user-1' }, error: null }
        },
      }),
    }),
  }
}

describe('ProviderListingApplications coverage', () => {
  it('loads the provider listing and shows the empty state', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { email: 'provider@example.com' } } },
      error: null,
    })

    mockFrom.mockImplementation((table) => {
      if (table === 'users') {
        return createUsersMock()
      }

      if (table === 'provider_profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: 'provider-profile-1' }, error: null }),
            }),
          }),
        }
      }

      if (table === 'opportunities') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 'listing-1',
                  title: 'Digital Skills Internship',
                  provider_id: 'provider-profile-1',
                  type: 'Internship',
                  location: 'Cape Town',
                  closing_date: '2026-06-30',
                  stipend: 4500,
                  description: 'Learn and grow',
                },
                error: null,
              }),
            }),
          }),
        }
      }

      if (table === 'applications') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: [], error: null }),
            }),
          }),
        }
      }

      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }
    })

    mockStorageFrom.mockImplementation((bucket) => {
      if (bucket === 'profile-images') {
        return {
          list: async () => ({ data: [{ name: 'avatar.png', created_at: '2026-05-18T00:00:00Z' }], error: null }),
          createSignedUrl: async (path) => ({ data: { signedUrl: `https://signed.local/${path}` }, error: null }),
          getPublicUrl: async () => ({ data: { publicUrl: '' } }),
        }
      }

      if (bucket === 'applicant-documents') {
        return {
          list: async () => ({
            data: [
              { name: '20260518-cv-resume.pdf', created_at: '2026-05-18T00:00:00Z' },
              { name: '20260518-id-card.pdf', created_at: '2026-05-18T00:00:00Z' },
            ],
            error: null,
          }),
          createSignedUrl: async (path) => ({ data: { signedUrl: `https://signed.local/${path}` }, error: null }),
          getPublicUrl: async () => ({ data: { publicUrl: '' } }),
        }
      }

      return {
        list: async () => ({ data: [], error: null }),
        createSignedUrl: async (path) => ({ data: { signedUrl: `https://signed.local/${path}` }, error: null }),
        getPublicUrl: async () => ({ data: { publicUrl: '' } }),
      }
    })

    render(
      <MemoryRouter initialEntries={['/provider/listings/listing-1/applications']}>
        <Routes>
          <Route path="/provider/listings/:listingId/applications" element={<ProviderListingApplications />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText(/Applicants - Digital Skills Internship/i)).toBeTruthy()
    await waitFor(() => {
      expect(screen.getByText(/No applications have been submitted yet/i)).toBeTruthy()
    })
  })

  it('updates an applicant status and shows the success message', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { email: 'provider@example.com' } } },
      error: null,
    })

    mockFrom.mockImplementation((table) => {
      if (table === 'users') {
        return createUsersMock()
      }

      if (table === 'provider_profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: 'provider-profile-1' }, error: null }),
            }),
          }),
        }
      }

      if (table === 'opportunities') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 'listing-1',
                  title: 'Digital Skills Internship',
                  provider_id: 'provider-profile-1',
                  type: 'Internship',
                  location: 'Cape Town',
                  closing_date: '2026-06-30',
                  stipend: 4500,
                  description: 'Learn and grow',
                },
                error: null,
              }),
            }),
          }),
        }
      }

      if (table === 'applications') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: [
                  {
                    id: 'app-1',
                    applicant_id: 'applicant-1',
                    status: 'Pending',
                    applied_at: '2026-05-01T10:00:00Z',
                    applicant_profiles: {
                      user_id: 'applicant-user-1',
                      auth_uid: 'applicant-auth-1',
                      first_name: 'Ava',
                      last_name: 'Mokoena',
                      phone: '0821234567',
                      location: 'Cape Town',
                      date_of_birth: '2001-04-05',
                      about_me: 'Ready to learn',
                      cv_url: '20260518-cv-resume.pdf',
                    },
                  },
                ],
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        }
      }

      if (table === 'notifications') {
        return {
          insert: async () => ({ data: null, error: null }),
        }
      }

      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }
    })

    mockStorageFrom.mockImplementation((bucket) => {
      if (bucket === 'profile-images') {
        return {
          list: async () => ({ data: [{ name: 'avatar.png', created_at: '2026-05-18T00:00:00Z' }], error: null }),
          createSignedUrl: async (path) => ({ data: { signedUrl: `https://signed.local/${path}` }, error: null }),
          getPublicUrl: async () => ({ data: { publicUrl: '' } }),
        }
      }

      if (bucket === 'applicant-documents') {
        return {
          list: async () => ({
            data: [
              { name: '20260518-cv-resume.pdf', created_at: '2026-05-18T00:00:00Z' },
              { name: '20260518-id-card.pdf', created_at: '2026-05-18T00:00:00Z' },
            ],
            error: null,
          }),
          createSignedUrl: async (path) => ({ data: { signedUrl: `https://signed.local/${path}` }, error: null }),
          getPublicUrl: async () => ({ data: { publicUrl: '' } }),
        }
      }

      return {
        list: async () => ({ data: [], error: null }),
        createSignedUrl: async (path) => ({ data: { signedUrl: `https://signed.local/${path}` }, error: null }),
        getPublicUrl: async () => ({ data: { publicUrl: '' } }),
      }
    })

    mockInvoke.mockResolvedValue({
      data: { notificationSent: true, emailSent: true },
      error: null,
    })

    render(
      <MemoryRouter initialEntries={['/provider/listings/listing-1/applications']}>
        <Routes>
          <Route path="/provider/listings/:listingId/applications" element={<ProviderListingApplications />} />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByText(/Applicants - Digital Skills Internship/i)
    const statusSelect = await screen.findByLabelText(/Application status for Ava Mokoena/i)
    fireEvent.change(statusSelect, { target: { value: 'Offered' } })
    fireEvent.click(screen.getByRole('button', { name: /Update status/i }))

    await waitFor(() => {
      expect(screen.getByText(/Updated Ava Mokoena to Accepted\./i)).toBeTruthy()
    })
  })

  it('opens a detailed applicant profile modal with education, skills, and documents', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { user: { email: 'provider@example.com' } } },
      error: null,
    })

    mockFrom.mockImplementation((table) => {
      if (table === 'users') {
        return createUsersMock()
      }

      if (table === 'provider_profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: 'provider-profile-1' }, error: null }),
            }),
          }),
        }
      }

      if (table === 'opportunities') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 'listing-1',
                  title: 'Digital Skills Internship',
                  provider_id: 'provider-profile-1',
                  type: 'Internship',
                  location: 'Cape Town',
                  closing_date: '2026-06-30',
                  stipend: 4500,
                  description: 'Learn and grow',
                },
                error: null,
              }),
            }),
          }),
        }
      }

      if (table === 'applications') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: [
                  {
                    id: 'app-1',
                    applicant_id: 'applicant-1',
                    status: 'Pending',
                    applied_at: '2026-05-01T10:00:00Z',
                    applicant_profiles: {
                      user_id: 'applicant-user-1',
                      auth_uid: 'applicant-auth-1',
                      first_name: 'Ava',
                      last_name: 'Mokoena',
                      phone: '0821234567',
                      location: 'Cape Town',
                      date_of_birth: '2001-04-05',
                      about_me: 'Ready to learn',
                      cv_url: '20260518-cv-resume.pdf',
                    },
                  },
                ],
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        }
      }

      if (table === 'notifications') {
        return {
          insert: async () => ({ data: null, error: null }),
        }
      }

      if (table === 'applicant_education') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({
                data: [
                  {
                    institution: 'Cape College',
                    qualification_id: 'qual-1',
                    nqf_level: 4,
                    year_completed: 2023,
                    qualification: { title: 'Business Administration', saqa_id: '12345' },
                  },
                ],
                error: null,
              }),
            }),
          }),
        }
      }

      if (table === 'applicant_skills') {
        return {
          select: () => ({
            eq: async () => ({
              data: [
                { skill_tag_id: 'skill-1', skill_tags: { id: 'skill-1', name: 'Communication' } },
                { skill_tag_id: 'skill-2', skill_tags: { id: 'skill-2', name: 'Teamwork' } },
              ],
              error: null,
            }),
          }),
        }
      }

      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }
    })

    mockStorageFrom.mockImplementation((bucket) => {
      if (bucket === 'profile-images') {
        return {
          list: async () => ({ data: [{ name: 'avatar.png', created_at: '2026-05-18T00:00:00Z' }], error: null }),
          createSignedUrl: async (path) => ({ data: { signedUrl: `https://signed.local/${path}` }, error: null }),
          getPublicUrl: async () => ({ data: { publicUrl: '' } }),
        }
      }

      if (bucket === 'applicant-documents') {
        return {
          list: async () => ({
            data: [
              { name: '20260518-cv-resume.pdf', created_at: '2026-05-18T00:00:00Z' },
              { name: '20260518-id-card.pdf', created_at: '2026-05-18T00:00:00Z' },
            ],
            error: null,
          }),
          createSignedUrl: async (path) => ({ data: { signedUrl: `https://signed.local/${path}` }, error: null }),
          getPublicUrl: async () => ({ data: { publicUrl: '' } }),
        }
      }

      return {
        list: async () => ({ data: [], error: null }),
        createSignedUrl: async (path) => ({ data: { signedUrl: `https://signed.local/${path}` }, error: null }),
        getPublicUrl: async () => ({ data: { publicUrl: '' } }),
      }
    })

    mockInvoke.mockResolvedValue({
      data: { notificationSent: true, emailSent: true },
      error: null,
    })

    render(
      <MemoryRouter initialEntries={['/provider/listings/listing-1/applications']}>
        <Routes>
          <Route path="/provider/listings/:listingId/applications" element={<ProviderListingApplications />} />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByText(/Applicants - Digital Skills Internship/i)
    fireEvent.click(screen.getByRole('button', { name: /View details/i }))

    expect(await screen.findByText('Applicant profile')).toBeTruthy()
    expect(screen.getAllByText(/Ava Mokoena/i).length).toBeGreaterThan(0)
    expect(await screen.findByText(/Cape College/i)).toBeTruthy()
    expect(await screen.findByText(/Communication/i)).toBeTruthy()
    expect(await screen.findByText(/Teamwork/i)).toBeTruthy()
    expect(screen.getByText(/Application received:/i)).toBeTruthy()
    expect(screen.getAllByText(/Location:/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Phone number:/i)).toBeTruthy()
    expect(screen.getByText(/Date of birth:/i)).toBeTruthy()
    expect(screen.getByText(/Open CV/i)).toBeTruthy()
    expect(screen.getByText(/ID card/i)).toBeTruthy()
  })
})
