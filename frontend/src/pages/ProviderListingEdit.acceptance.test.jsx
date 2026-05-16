import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const editState = vi.hoisted(() => ({
  hasSupabaseConfig: true,
  authEmail: 'provider@example.com',
  userRow: { id: 'user-1' },
  providerRow: { id: 'provider-1' },
  listingRow: {
    id: 'listing-1',
    title: 'Digital Literacy Programme',
    type: 'Learnership',
    description: 'Help learners build office and digital skills.',
    stipend: 4200,
    location: 'Cape Town',
    duration: '6 months',
    closing_date: '2099-12-31',
    status: 'Pending',
  },
  requirementRow: { id: 'requirement-1', description: 'Basic computer literacy' },
  opportunityUpdatePayload: null,
  requirementUpdatePayload: null,
  requirementInsertPayload: null,
  updateOpportunityError: null,
  requirementUpdateError: null,
  requirementInsertError: null,
  submitError: null,
}))

const editSpies = vi.hoisted(() => ({
  getSession: vi.fn(),
  userMaybeSingle: vi.fn(),
  providerMaybeSingle: vi.fn(),
  listingMaybeSingle: vi.fn(),
  requirementMaybeSingle: vi.fn(),
  opportunityUpdate: vi.fn(),
  requirementUpdate: vi.fn(),
  requirementInsert: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => editSpies.navigate,
  }
})

vi.mock('../lib/supabaseClient', () => ({
  get hasSupabaseConfig() {
    return editState.hasSupabaseConfig
  },
  supabase: {
    auth: {
      getSession: editSpies.getSession,
    },
    from: vi.fn((tableName) => {
      if (tableName === 'users') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: editSpies.userMaybeSingle })),
          })),
        }
      }

      if (tableName === 'provider_profiles') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: editSpies.providerMaybeSingle })),
          })),
        }
      }

      if (tableName === 'opportunities') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({ maybeSingle: editSpies.listingMaybeSingle })),
            })),
          })),
          update: vi.fn((payload) => {
            editState.opportunityUpdatePayload = payload
            return {
              eq: vi.fn(() => ({
                eq: vi.fn(async () => ({ error: editState.updateOpportunityError })),
              })),
            }
          }),
        }
      }

      if (tableName === 'opportunity_requirements') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: editSpies.requirementMaybeSingle })),
          })),
          update: vi.fn((payload) => {
            editState.requirementUpdatePayload = payload
            return {
              eq: vi.fn(async () => ({ error: editState.requirementUpdateError })),
            }
          }),
          insert: vi.fn((payload) => {
            editState.requirementInsertPayload = payload
            return Promise.resolve({ error: editState.requirementInsertError })
          }),
        }
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })),
        })),
      }
    }),
  },
}))

const loadProviderListingEdit = async () => (await import('./ProviderListingEdit')).default

function renderEditPage() {
  return render(
    <MemoryRouter initialEntries={['/provider/listings/listing-1/edit']}>
      <Routes>
        <Route path="/provider/listings/:listingId/edit" element={<ProviderListingEdit />} />
      </Routes>
    </MemoryRouter>,
  )
}

let ProviderListingEdit

beforeEach(async () => {
  vi.clearAllMocks()
  editState.authEmail = 'provider@example.com'
  editState.userRow = { id: 'user-1' }
  editState.providerRow = { id: 'provider-1' }
  editState.listingRow = {
    id: 'listing-1',
    title: 'Digital Literacy Programme',
    type: 'Learnership',
    description: 'Help learners build office and digital skills.',
    stipend: 4200,
    location: 'Cape Town',
    duration: '6 months',
    closing_date: '2099-12-31',
    status: 'Pending',
  }
  editState.requirementRow = { id: 'requirement-1', description: 'Basic computer literacy' }
  editState.opportunityUpdatePayload = null
  editState.requirementUpdatePayload = null
  editState.requirementInsertPayload = null
  editState.updateOpportunityError = null
  editState.requirementUpdateError = null
  editState.requirementInsertError = null
  editState.hasSupabaseConfig = true
  editSpies.navigate.mockReset()

  editSpies.getSession.mockResolvedValue({
    data: { session: { user: { email: editState.authEmail } } },
    error: null,
  })
  editSpies.userMaybeSingle.mockResolvedValue({ data: editState.userRow, error: null })
  editSpies.providerMaybeSingle.mockResolvedValue({ data: editState.providerRow, error: null })
  editSpies.listingMaybeSingle.mockResolvedValue({ data: editState.listingRow, error: null })
  editSpies.requirementMaybeSingle.mockResolvedValue({ data: editState.requirementRow, error: null })

  ProviderListingEdit = await loadProviderListingEdit()
})

afterEach(() => {
  cleanup()
})

describe('Provider listing edit acceptance tests', () => {
  test('renders the saved listing and updates it on submit', async () => {
    renderEditPage()

    expect(await screen.findByDisplayValue('Digital Literacy Programme')).toBeTruthy()
    expect(screen.getByDisplayValue('Basic computer literacy')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Digital Skills Programme Updated' },
    })
    fireEvent.change(screen.getByLabelText('Requirements'), {
      target: { value: 'Basic computer literacy and email usage' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(editState.opportunityUpdatePayload).toBeTruthy())
    expect(editState.opportunityUpdatePayload.title).toBe('Digital Skills Programme Updated')
    expect(editState.requirementUpdatePayload.description).toBe('Basic computer literacy and email usage')
    expect(editSpies.navigate).toHaveBeenCalledWith('/provider', { replace: true })
  })

  test('shows validation errors for empty fields', async () => {
    editState.listingRow = null
    editSpies.listingMaybeSingle.mockResolvedValue({ data: null, error: null })
    editSpies.requirementMaybeSingle.mockResolvedValue({ data: null, error: null })

    renderEditPage()

    await screen.findByText('Edit details')
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(screen.getByText('Title is required.')).toBeTruthy()
      expect(screen.getByText('Description is required.')).toBeTruthy()
      expect(screen.getByText('Location is required.')).toBeTruthy()
      expect(screen.getByText('Duration is required.')).toBeTruthy()
      expect(screen.getByText('Requirements are required.')).toBeTruthy()
      expect(screen.getByText('Closing date is required.')).toBeTruthy()
      expect(screen.getByText('Stipend is required.')).toBeTruthy()
    })
  })

  test('shows an error when Supabase is not configured', async () => {
    editState.hasSupabaseConfig = false

    renderEditPage()

    expect(await screen.findByText('Supabase is not configured. Listing edit requires database access.')).toBeTruthy()
  })

  test('shows an error when the listing cannot be loaded', async () => {
    editState.listingRow = null
    editSpies.listingMaybeSingle.mockResolvedValue({ data: null, error: null })
    editSpies.requirementMaybeSingle.mockResolvedValue({ data: null, error: null })

    renderEditPage()

    expect(
      await screen.findByText('Listing not found or you do not have permission to edit it.'),
    ).toBeTruthy()
  })

  test('shows an error when the provider profile cannot be loaded', async () => {
    editSpies.providerMaybeSingle.mockResolvedValue({ data: null, error: null })

    renderEditPage()

    expect(await screen.findByText('Provider profile was not found.')).toBeTruthy()
  })

  test('cancels saving an approved listing when confirmation is dismissed', async () => {
    editState.listingRow = {
      ...editState.listingRow,
      status: 'Approved',
    }
    editSpies.listingMaybeSingle.mockResolvedValue({ data: editState.listingRow, error: null })
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderEditPage()

    expect(await screen.findByDisplayValue('Digital Literacy Programme')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(editState.opportunityUpdatePayload).toBe(null))
    expect(editSpies.navigate).not.toHaveBeenCalled()
  })

  test('creates a requirements row when none exists', async () => {
    editSpies.requirementMaybeSingle.mockResolvedValue({ data: null, error: null })

    renderEditPage()

    expect(await screen.findByDisplayValue('Digital Literacy Programme')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Digital Skills Programme Updated' },
    })
    fireEvent.change(screen.getByLabelText('Requirements'), {
      target: { value: 'Basic computer literacy and email usage' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(editState.requirementInsertPayload).toBeTruthy())
    expect(editState.requirementInsertPayload.description).toBe('Basic computer literacy and email usage')
    expect(editSpies.navigate).toHaveBeenCalledWith('/provider', { replace: true })
  })

  test('shows an error when the listing update fails', async () => {
    editState.updateOpportunityError = new Error('update failed')

    renderEditPage()

    expect(await screen.findByDisplayValue('Digital Literacy Programme')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Listing could not be updated. Please try again.')).toBeTruthy()
    expect(editSpies.navigate).not.toHaveBeenCalled()
  })

  test('shows an error when saving requirements fails', async () => {
    editState.requirementInsertError = new Error('requirements failed')
    editSpies.requirementMaybeSingle.mockResolvedValue({ data: null, error: null })

    renderEditPage()

    expect(await screen.findByDisplayValue('Digital Literacy Programme')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Requirements'), {
      target: { value: 'Basic computer literacy and email usage' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Listing requirements could not be updated.')).toBeTruthy()
    expect(editSpies.navigate).not.toHaveBeenCalled()
  })
})