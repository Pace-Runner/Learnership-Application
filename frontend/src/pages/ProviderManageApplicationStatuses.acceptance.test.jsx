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
  updatedApplicationId: '',
  insertedNotificationPayload: null,
  insertedEmailLogPayload: null,
  invokedEmailFunction: '',
  invokedEmailPayload: null,
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
        return {
          eq: vi.fn(async (_column, applicationId) => {
            mockState.updatedApplicationId = applicationId
            return { data: null, error: mockState.applicationUpdateError }
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

  if (tableName === 'email_logs') {
    return {
      insert: vi.fn(async (payload) => {
        mockState.insertedEmailLogPayload = payload
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
          : { data: { success: true }, error: null }
      }),
    },
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(async () => ({
          data: { signedUrl: 'https://example.com/signed-cv.pdf' },
          error: null,
        })),
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
      status: 'Received',
      applied_at: '2026-05-08T09:00:00.000Z',
      applicant_profiles: {
        user_id: 'app-user-1',
        first_name: 'Ava',
        last_name: 'Dlamini',
        about_me: 'Entry-level IT support candidate with service desk exposure.',
        cv_url: 'https://example.com/ava-cv.pdf',
        users: {
          email: 'ava@example.com',
        },
      },
    },
  ]
  mockState.applicationUpdateError = null
  mockState.notificationInsertError = null
  mockState.emailInvokeError = null
  mockState.updatedApplicationPayload = null
  mockState.updatedApplicationId = ''
  mockState.insertedNotificationPayload = null
  mockState.insertedEmailLogPayload = null
  mockState.invokedEmailFunction = ''
  mockState.invokedEmailPayload = null
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

  test('3. Changing an applicant status triggers a status_update notification for the applicant', async () => {
    renderApplicationsPage()

    expect(await screen.findByText('Ava Dlamini')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Application status for Ava Dlamini'), {
      target: { value: 'Offered' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Update status' }))

    await waitFor(() => {
      expect(mockState.insertedNotificationPayload).toBeTruthy()
    })

    expect(mockState.insertedNotificationPayload.user_id).toBe('app-user-1')
    expect(mockState.insertedNotificationPayload.type).toBe('status_update')
    expect(mockState.insertedNotificationPayload.message).toContain('Accepted')
    expect(mockState.insertedNotificationPayload.message).toContain('IT Support Internship 2026')
  })

  test('4. Changing an applicant status triggers the email function and records a sent email log', async () => {
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
      toEmail: 'ava@example.com',
      applicantName: 'Ava Dlamini',
      listingTitle: 'IT Support Internship 2026',
      statusLabel: 'Accepted',
    })
    expect(mockState.insertedEmailLogPayload).toEqual({
      user_id: 'app-user-1',
      subject: 'Application update: IT Support Internship 2026',
      status: 'sent',
    })
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
})
