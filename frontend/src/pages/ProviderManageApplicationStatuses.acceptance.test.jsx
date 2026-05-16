import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ProviderListingApplications from './ProviderListingApplications'

const mockState = {
  authEmail: 'provider@example.com',
  userRow: { id: 'user-1' },
  providerRow: { id: 'provider-1' },
  listingRow: { id: 'listing-1', title: 'IT Support Internship 2026', provider_id: 'provider-1' },
  applicationRows: [],
  applicationUpdateError: null,
  notificationInsertError: null,
  emailInvokeError: null,
  updatedApplicationPayload: null,
  updatedApplicationPayloads: [],
  updatedApplicationId: '',
  insertedNotificationPayload: null,
  invokedEmailFunction: '',
  invokedEmailPayload: null,
  signedUrlPaths: [],
}

function buildTableQuery(tableName) {
  if (tableName === 'users') {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: mockState.userRow, error: null })),
        })),
      })),
    }
  }

  if (tableName === 'provider_profiles') {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: mockState.providerRow, error: null })),
        })),
      })),
    }
  }

  if (tableName === 'opportunities') {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: mockState.listingRow, error: null })),
        })),
      })),
    }
  }

  if (tableName === 'applications') {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(async () => ({ data: mockState.applicationRows, error: null })),
        })),
      })),
      update: vi.fn((payload) => {
        mockState.updatedApplicationPayload = payload
        mockState.updatedApplicationPayloads.push(payload)
        return {
          eq: vi.fn(async (_column, applicationId) => {
            mockState.updatedApplicationId = applicationId
            const updateError = typeof mockState.applicationUpdateError === 'function'
              ? mockState.applicationUpdateError(payload)
              : mockState.applicationUpdateError

            return { data: null, error: updateError }
          }),
        }
      }),
    }
  }

  if (tableName === 'notifications') {
    return {
      insert: vi.fn(async (payload) => {
        mockState.insertedNotificationPayload = payload
        return { data: null, error: mockState.notificationInsertError }
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
}

vi.mock('../lib/supabaseClient', () => ({
  hasSupabaseConfig: true,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { user: { email: mockState.authEmail } } },
        error: null,
      })),
    },
    from: vi.fn((tableName) => buildTableQuery(tableName)),
    functions: {
      invoke: vi.fn(async (functionName, options) => {
        mockState.invokedEmailFunction = functionName
        mockState.invokedEmailPayload = options?.body || null
        return mockState.emailInvokeError
          ? { data: null, error: mockState.emailInvokeError }
          : { data: { success: true, notificationSent: true, emailSent: true }, error: null }
      }),
    },
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(async (path) => {
          mockState.signedUrlPaths.push(path)

          return {
          data: { signedUrl: 'https://example.com/signed-cv.pdf' },
          error: null,
          }
        }),
      })),
    },
  },
}))

function renderApplicationsPage() {
  return render(
    <MemoryRouter initialEntries={['/provider/listings/listing-1/applications']}>
      <Routes>
        <Route path="/provider/listings/:listingId/applications" element={<ProviderListingApplications />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockState.authEmail = 'provider@example.com'
  mockState.userRow = { id: 'user-1' }
  mockState.providerRow = { id: 'provider-1' }
  mockState.listingRow = { id: 'listing-1', title: 'IT Support Internship 2026', provider_id: 'provider-1' }
  mockState.applicationRows = [
    {
      id: 'application-1',
      applicant_id: 'profile-1',
      status: 'Pending',
      applied_at: '2026-05-08T09:00:00.000Z',
      applicant_profiles: {
        user_id: 'app-user-1',
        first_name: 'Ava',
        last_name: 'Dlamini',
        about_me: 'Entry-level IT support candidate with service desk exposure.',
        cv_url: 'https://example.com/ava-cv.pdf',
      },
    },
  ]
  mockState.applicationUpdateError = null
  mockState.notificationInsertError = null
  mockState.emailInvokeError = null
  mockState.updatedApplicationPayload = null
  mockState.updatedApplicationPayloads = []
  mockState.updatedApplicationId = ''
  mockState.insertedNotificationPayload = null
  mockState.invokedEmailFunction = ''
  mockState.invokedEmailPayload = null
  mockState.signedUrlPaths = []
})

afterEach(() => {
  cleanup()
})

describe('Provider manage application statuses acceptance tests', () => {
  test('1. Applications page renders a status control with Pending, Reviewed, Accepted, and Rejected options', async () => {
    renderApplicationsPage()

    expect(await screen.findByText('Ava Dlamini')).toBeTruthy()

    const statusSelect = screen.getByLabelText('Application status for Ava Dlamini')
    const optionLabels = Array.from(statusSelect.querySelectorAll('option')).map((option) => option.textContent)

    expect(optionLabels).toEqual(['Pending', 'Reviewed', 'Accepted', 'Rejected'])
  })

  test('2. Updating an applicant status writes the mapped status to the applications table', async () => {
    renderApplicationsPage()

    expect(await screen.findByText('Ava Dlamini')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Application status for Ava Dlamini'), {
      target: { value: 'Shortlisted' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update status' }))

    await waitFor(() => {
      expect(mockState.updatedApplicationPayload).toBeTruthy()
    })

    expect(mockState.updatedApplicationId).toBe('application-1')
    expect(mockState.updatedApplicationPayload.status).toBe('Shortlisted')
    expect(mockState.updatedApplicationPayload.updated_at).toBeTruthy()
  })

  test('3. Changing an applicant status triggers the status delivery function for in-app notification', async () => {
    renderApplicationsPage()

    expect(await screen.findByText('Ava Dlamini')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Application status for Ava Dlamini'), {
      target: { value: 'Offered' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update status' }))

    await waitFor(() => {
      expect(mockState.invokedEmailPayload).toBeTruthy()
    })

    expect(mockState.invokedEmailFunction).toBe('send-status-email')
    expect(mockState.invokedEmailPayload).toEqual({
      applicationId: 'application-1',
      applicantName: 'Ava Dlamini',
      listingTitle: 'IT Support Internship 2026',
      statusLabel: 'Accepted',
    })
  })

  test('4. Changing an applicant status falls back to Received if the database rejects Pending', async () => {
    mockState.applicationRows[0].status = 'Shortlisted'
    mockState.applicationUpdateError = (payload) => (
      payload.status === 'Pending' ? { message: 'Status check constraint failed.' } : null
    )

    renderApplicationsPage()

    expect(await screen.findByText('Ava Dlamini')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Application status for Ava Dlamini'), {
      target: { value: 'Pending' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update status' }))

    await waitFor(() => {
      expect(mockState.updatedApplicationPayload).toBeTruthy()
    })

    expect(mockState.updatedApplicationPayloads.map((payload) => payload.status)).toEqual(['Pending', 'Received'])
    expect(mockState.updatedApplicationPayload.status).toBe('Received')
    expect(await screen.findByText('Current status: Pending')).toBeTruthy()
  })

  test('5. The visible application status updates after saving the provider action', async () => {
    renderApplicationsPage()

    expect(await screen.findByText('Ava Dlamini')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Application status for Ava Dlamini'), {
      target: { value: 'Rejected' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update status' }))

    expect(await screen.findByText('Current status: Rejected')).toBeTruthy()
    expect(screen.getByText('Updated Ava Dlamini to Rejected.')).toBeTruthy()
  })

  test('6. If the email function fails, the applicant still gets an in-app notification fallback', async () => {
    mockState.emailInvokeError = { message: 'Function not deployed yet.' }

    renderApplicationsPage()

    expect(await screen.findByText('Ava Dlamini')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Application status for Ava Dlamini'), {
      target: { value: 'Offered' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update status' }))

    await waitFor(() => {
      expect(mockState.insertedNotificationPayload).toBeTruthy()
    })

    expect(mockState.insertedNotificationPayload).toEqual({
      user_id: 'app-user-1',
      type: 'status_update',
      message: 'Your application for IT Support Internship 2026 is now Accepted.',
    })
    expect(screen.getByText('Updated Ava Dlamini to Accepted, but the email notification could not be sent.')).toBeTruthy()
  })

  test('7. A filename-only CV resolves to a valid provider download link', async () => {
    mockState.applicationRows[0].applicant_profiles.user_id = ''
    mockState.applicationRows[0].applicant_profiles.cv_url = 'ava-dlamini-cv.pdf'

    renderApplicationsPage()

    expect(await screen.findByText('Ava Dlamini')).toBeTruthy()
    expect(mockState.signedUrlPaths).toEqual(['ava-dlamini-cv.pdf'])
    expect(screen.getByRole('link', { name: 'Download CV' }).getAttribute('href')).toBe(
      'https://example.com/signed-cv.pdf',
    )

    fireEvent.click(screen.getByRole('button', { name: 'View details' }))
    expect(await screen.findByText('Applicant details')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open CV' })).toBeTruthy()
  })

  test('8. Shows an empty state when the listing has no applications yet', async () => {
    mockState.applicationRows = []

    renderApplicationsPage()

    expect(await screen.findByText('No applications have been submitted yet.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Update status' })).toBeNull()
  })

  test('9. Shows a sign-in error when the provider session is missing', async () => {
    mockState.authEmail = ''

    renderApplicationsPage()

    expect(await screen.findByText('You must be signed in as a Provider to view applicants.')).toBeTruthy()
  })

  test('10. Shows a permission error when the listing does not belong to the provider', async () => {
    mockState.listingRow = { id: 'listing-1', title: 'IT Support Internship 2026', provider_id: 'other-provider' }

    renderApplicationsPage()

    expect(await screen.findByText('Listing not found or you do not have permission to view it.')).toBeTruthy()
  })
})
