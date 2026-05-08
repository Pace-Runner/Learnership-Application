import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const detailState = vi.hoisted(() => ({
  authEmail: 'applicant@example.com',
  userRow: { id: 'user-1' },
  profileRow: {
    id: 'profile-1',
    user_id: 'user-1',
    first_name: 'Ava',
    last_name: 'Ndlovu',
    phone: '0825551111',
    location: 'Cape Town',
    date_of_birth: '2001-03-04',
    id_number: '0103045009087',
    cv_url: 'user-1/ava-cv.pdf',
    about_me: 'Ready to learn and contribute.',
  },
  listingRow: {
    id: 'listing-1',
    title: 'Business Administration NQF 4',
    type: 'Learnership',
    description: 'Office support and administration track',
    stipend: 4500,
    location: 'Cape Town',
    duration: '12 months',
    closing_date: '2026-06-01',
    status: 'Approved',
  },
  applicationInsertPayload: null,
}))

const detailSpies = vi.hoisted(() => ({
  getSession: vi.fn(),
  userMaybeSingle: vi.fn(),
  profileMaybeSingle: vi.fn(),
  listingMaybeSingle: vi.fn(),
  applicationInsert: vi.fn(),
}))

const applicationInsertCalls = []

vi.mock('../lib/supabaseClient', () => ({
  hasSupabaseConfig: true,
  supabase: {
    auth: {
      getSession: detailSpies.getSession,
    },
    from: vi.fn((tableName) => {
      if (tableName === 'users') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: detailSpies.userMaybeSingle,
            })),
          })),
        }
      }

      if (tableName === 'applicant_profiles') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: detailSpies.profileMaybeSingle,
            })),
          })),
        }
      }

      if (tableName === 'opportunities') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: detailSpies.listingMaybeSingle,
            })),
          })),
        }
      }

      if (tableName === 'applications') {
        return {
          insert: detailSpies.applicationInsert.mockImplementation(async (payload) => {
            applicationInsertCalls.push(payload)
            detailState.applicationInsertPayload = payload

            if (payload.status === 'Pending') {
              return {
                data: null,
                error: {
                  message: 'new row for relation "applications" violates check constraint "applications_status_check"',
                  details: 'status value not allowed',
                },
              }
            }

            return { data: null, error: null }
          }),
        }
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      }
    }),
  },
}))

const loadApplicantListingDetail = async () => (await import('./ApplicantListingDetail')).default

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  vi.clearAllMocks()
  detailState.authEmail = 'applicant@example.com'
  detailState.userRow = { id: 'user-1' }
  detailState.profileRow = {
    id: 'profile-1',
    user_id: 'user-1',
    first_name: 'Ava',
    last_name: 'Ndlovu',
    phone: '0825551111',
    location: 'Cape Town',
    date_of_birth: '2001-03-04',
    id_number: '0103045009087',
    cv_url: 'user-1/ava-cv.pdf',
    about_me: 'Ready to learn and contribute.',
  }
  detailState.listingRow = {
    id: 'listing-1',
    title: 'Business Administration NQF 4',
    type: 'Learnership',
    description: 'Office support and administration track',
    stipend: 4500,
    location: 'Cape Town',
    duration: '12 months',
    closing_date: '2026-06-01',
    status: 'Approved',
  }
  detailState.applicationInsertPayload = null
  applicationInsertCalls.length = 0

  detailSpies.getSession.mockResolvedValue({
    data: { session: { user: { email: detailState.authEmail } } },
    error: null,
  })
  detailSpies.userMaybeSingle.mockResolvedValue({ data: detailState.userRow, error: null })
  detailSpies.profileMaybeSingle.mockResolvedValue({ data: detailState.profileRow, error: null })
  detailSpies.listingMaybeSingle.mockResolvedValue({ data: detailState.listingRow, error: null })
})

describe('Applicant listing detail acceptance tests', () => {
  test('renders the listing detail page and one-click apply button', async () => {
    const ApplicantListingDetail = await loadApplicantListingDetail()

    render(
      <MemoryRouter initialEntries={['/dashboard/listings/listing-1']}>
        <Routes>
          <Route path="/dashboard/listings/:listingId" element={<ApplicantListingDetail onLogout={vi.fn()} />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Business Administration NQF 4')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Apply now' })).toBeTruthy()
    expect(screen.getByText(/Ava Ndlovu/i)).toBeTruthy()
    expect(screen.getByText(/user-1\/ava-cv\.pdf/i)).toBeTruthy()
  })

  test('submits an application using the saved profile and CV and falls back when Pending is rejected', async () => {
    const ApplicantListingDetail = await loadApplicantListingDetail()

    render(
      <MemoryRouter initialEntries={['/dashboard/listings/listing-1']}>
        <Routes>
          <Route path="/dashboard/listings/:listingId" element={<ApplicantListingDetail onLogout={vi.fn()} />} />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByRole('button', { name: 'Apply now' })
    fireEvent.click(screen.getByRole('button', { name: 'Apply now' }))

    await waitFor(() => {
      expect(applicationInsertCalls).toEqual([
        {
        applicant_id: 'profile-1',
        opportunity_id: 'listing-1',
        status: 'Pending',
        },
        {
          applicant_id: 'profile-1',
          opportunity_id: 'listing-1',
        },
      ])
    })

    expect(
      await screen.findByText(/Your application has been submitted successfully/i),
    ).toBeTruthy()
  })
})