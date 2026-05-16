import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const navigateSpy = vi.fn()

const formState = vi.hoisted(() => ({
  hasSupabaseConfig: true,
  authEmail: 'provider@example.com',
  userRow: { id: 'user-1' },
  providerRow: { id: 'provider-1' },
  opportunityRow: { id: 'opportunity-1' },
  qualificationRows: [
    { id: 'qual-1', title: 'Business Administration Certificate', nqf_level: 4, saqa_id: '12345' },
    { id: 'qual-2', title: 'Project Management Diploma', nqf_level: 6, saqa_id: '67890' },
  ],
  qualificationError: null,
  sessionError: null,
  userError: null,
  providerError: null,
  opportunityError: null,
  requirementsError: null,
  deletedOpportunityId: '',
}))

const formSpies = vi.hoisted(() => ({
  getSession: vi.fn(),
  usersMaybeSingle: vi.fn(),
  providerMaybeSingle: vi.fn(),
  opportunityInsert: vi.fn(),
  requirementsInsert: vi.fn(),
  opportunityDeleteEq: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  }
})

vi.mock('../lib/supabaseClient', () => ({
  get hasSupabaseConfig() {
    return formState.hasSupabaseConfig
  },
  supabase: {
    auth: {
      getSession: formSpies.getSession,
    },
    from: vi.fn((tableName) => {
      if (tableName === 'nqf_qualifications') {
        return {
          select: () => ({
            order: async () => ({ data: formState.qualificationRows, error: formState.qualificationError }),
          }),
        }
      }

      if (tableName === 'users') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: formSpies.usersMaybeSingle,
            }),
          }),
        }
      }

      if (tableName === 'provider_profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: formSpies.providerMaybeSingle,
            }),
          }),
        }
      }

      if (tableName === 'opportunities') {
        return {
          insert: formSpies.opportunityInsert,
          delete: () => ({
            eq: formSpies.opportunityDeleteEq,
          }),
        }
      }

      if (tableName === 'opportunity_requirements') {
        return {
          insert: formSpies.requirementsInsert,
        }
      }

      return {
        select: () => ({
          eq: () => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          }),
        }),
      }
    }),
  },
}))

const loadForm = async () => (await import('./ProviderListingForm')).default

beforeEach(() => {
  vi.clearAllMocks()
  navigateSpy.mockClear()
  formState.hasSupabaseConfig = true
  formState.authEmail = 'provider@example.com'
  formState.userRow = { id: 'user-1' }
  formState.providerRow = { id: 'provider-1' }
  formState.opportunityRow = { id: 'opportunity-1' }
  formState.qualificationRows = [
    { id: 'qual-1', title: 'Business Administration Certificate', nqf_level: 4, saqa_id: '12345' },
    { id: 'qual-2', title: 'Project Management Diploma', nqf_level: 6, saqa_id: '67890' },
  ]
  formState.qualificationError = null
  formState.sessionError = null
  formState.userError = null
  formState.providerError = null
  formState.opportunityError = null
  formState.requirementsError = null
  formState.deletedOpportunityId = ''

  formSpies.getSession.mockImplementation(async () => ({
    data: { session: { user: { email: formState.authEmail } } },
    error: formState.sessionError,
  }))
  formSpies.usersMaybeSingle.mockImplementation(async () => ({ data: formState.userRow, error: formState.userError }))
  formSpies.providerMaybeSingle.mockImplementation(async () => ({ data: formState.providerRow, error: formState.providerError }))
  formSpies.opportunityInsert.mockImplementation((payload) => ({
    select: () => ({
      single: async () => ({
        data: formState.opportunityError ? null : formState.opportunityRow,
        error: formState.opportunityError,
        payload,
      }),
    }),
  }))
  formSpies.requirementsInsert.mockImplementation(async (payload) => ({
    data: null,
    error: formState.requirementsError,
    payload,
  }))
  formSpies.opportunityDeleteEq.mockImplementation(async (_column, id) => {
    formState.deletedOpportunityId = id
    return { error: null }
  })
})

afterEach(() => {
  cleanup()
})

describe('ProviderListingForm acceptance tests', () => {
  test('loads qualification options and shows the stipend preview', async () => {
    const ProviderListingForm = await loadForm()

    render(
      <MemoryRouter>
        <ProviderListingForm />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Business Administration Certificate (NQF 4)')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Stipend amount in Rand'), { target: { value: '4500' } })
      expect(await screen.findByText(/Stipend preview:/i)).toBeTruthy()
  })

  test('shows validation errors when required fields are missing', async () => {
    const ProviderListingForm = await loadForm()

    render(
      <MemoryRouter>
        <ProviderListingForm />
      </MemoryRouter>,
    )

    await screen.findByText('Business Administration Certificate (NQF 4)')
    fireEvent.click(screen.getByRole('button', { name: 'Submit listing' }))

    expect(await screen.findByText('Title is required.')).toBeTruthy()
    expect(screen.getByText('Description is required.')).toBeTruthy()
    expect(screen.getByText('Requirements are required.')).toBeTruthy()
    expect(screen.getByText('Stipend is required.')).toBeTruthy()
    expect(formSpies.opportunityInsert).not.toHaveBeenCalled()
  })

  test('rejects a past closing date and an invalid stipend', async () => {
    const ProviderListingForm = await loadForm()

    render(
      <MemoryRouter>
        <ProviderListingForm />
      </MemoryRouter>,
    )

    await screen.findByText('Business Administration Certificate (NQF 4)')

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Junior IT Support Internship' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Hands-on support role' } })
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Johannesburg' } })
    fireEvent.change(screen.getByLabelText('Duration'), { target: { value: '12 months' } })
    fireEvent.change(screen.getByLabelText('Requirements'), { target: { value: 'Grade 12' } })
    fireEvent.change(screen.getByLabelText('Qualification'), { target: { value: 'qual-1' } })
    fireEvent.change(screen.getByLabelText('NQF level required'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('Closing date'), { target: { value: '2000-01-01' } })
    fireEvent.change(screen.getByLabelText('Stipend amount in Rand'), { target: { value: '-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit listing' }))

    expect(await screen.findByText('Closing date cannot be in the past.')).toBeTruthy()
    expect(screen.getByText('Stipend must be a positive number.')).toBeTruthy()
    expect(formSpies.opportunityInsert).not.toHaveBeenCalled()
  })

  test('submits a valid listing and creates the requirements row', async () => {
    const ProviderListingForm = await loadForm()

    render(
      <MemoryRouter>
        <ProviderListingForm />
      </MemoryRouter>,
    )

    await screen.findByText('Business Administration Certificate (NQF 4)')

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Junior IT Support Internship' } })
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'Internship' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Hands-on support role' } })
    fireEvent.change(screen.getByLabelText('Stipend amount in Rand'), { target: { value: '4500' } })
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Johannesburg' } })
    fireEvent.change(screen.getByLabelText('Duration'), { target: { value: '12 months' } })
    fireEvent.change(screen.getByLabelText('Requirements'), { target: { value: 'Grade 12' } })
    fireEvent.change(screen.getByLabelText('Qualification'), { target: { value: 'qual-2' } })
    fireEvent.change(screen.getByLabelText('NQF level required'), { target: { value: '6' } })
    fireEvent.change(screen.getByLabelText('Closing date'), { target: { value: '2099-12-31' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit listing' }))

    await waitFor(() => expect(formSpies.opportunityInsert).toHaveBeenCalled())
    expect(formSpies.requirementsInsert).toHaveBeenCalled()
    expect(navigateSpy).toHaveBeenCalledWith('/provider', { replace: true })

    const listingPayload = formSpies.opportunityInsert.mock.calls[0]?.[0]
    expect(listingPayload.provider_id).toBe('provider-1')
    expect(listingPayload.title).toBe('Junior IT Support Internship')
    expect(listingPayload.status).toBe('Pending')

    const requirementsPayload = formSpies.requirementsInsert.mock.calls[0]?.[0]
    expect(requirementsPayload.opportunity_id).toBe('opportunity-1')
    expect(requirementsPayload.nqf_level_required).toBe(6)
  })

})
