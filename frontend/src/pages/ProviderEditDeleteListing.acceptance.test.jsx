import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cwd } from 'node:process'
import Provider from './Provider'
import ProviderListingEdit from './ProviderListingEdit'

const mockState = {
  authEmail: 'provider@example.com',
  userRow: { id: 'user-1' },
  providerRow: { id: 'provider-1' },
  listings: [],
  listingForEdit: null,
  requirementRow: null,
  updatedOpportunityPayload: null,
  updatedRequirementPayload: null,
  insertedRequirementPayload: null,
  deletedOpportunityIds: [],
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
      select: vi.fn((query) => ({
        eq: vi.fn((field, value) => {
          if (field === 'provider_id' && query.includes('created_at')) {
            return {
              order: vi.fn(async () => ({ data: mockState.listings, error: null })),
            }
          }

          if (field === 'id') {
            return {
              eq: vi.fn((providerField, providerValue) => ({
                maybeSingle: vi.fn(async () => ({
                  data:
                    providerField === 'provider_id' &&
                    providerValue === mockState.providerRow.id &&
                    mockState.listingForEdit?.id === value
                      ? mockState.listingForEdit
                      : null,
                  error: null,
                })),
              })),
            }
          }

          return {
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          }
        }),
      })),
      update: vi.fn((payload) => {
        mockState.updatedOpportunityPayload = payload

        return {
          eq: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null })),
          })),
        }
      }),
      delete: vi.fn(() => ({
        eq: vi.fn((field, idValue) => ({
          eq: vi.fn(async () => {
            if (field === 'id') {
              mockState.deletedOpportunityIds.push(idValue)
            }

            return { error: null }
          }),
        })),
      })),
    }
  }

  if (tableName === 'opportunity_requirements') {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: mockState.requirementRow, error: null })),
        })),
      })),
      update: vi.fn((payload) => {
        mockState.updatedRequirementPayload = payload

        return {
          eq: vi.fn(async () => ({ error: null })),
        }
      }),
      insert: vi.fn(async (payload) => {
        mockState.insertedRequirementPayload = payload
        return { error: null }
      }),
      delete: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
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

vi.mock('../lib/supabaseClient', () => {
  return {
    hasSupabaseConfig: true,
    supabase: {
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { user: { email: mockState.authEmail } } },
          error: null,
        })),
      },
      from: vi.fn((tableName) => buildTableQuery(tableName)),
    },
  }
})

function renderEditPage() {
  return render(
    <MemoryRouter initialEntries={['/provider/listings/listing-1/edit']}>
      <Routes>
        <Route path="/provider/listings/:listingId/edit" element={<ProviderListingEdit />} />
        <Route path="/provider" element={<p>Provider Dashboard</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function renderProviderPage() {
  return render(
    <MemoryRouter>
      <Provider onLogout={vi.fn()} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockState.authEmail = 'provider@example.com'
  mockState.userRow = { id: 'user-1' }
  mockState.providerRow = { id: 'provider-1' }
  mockState.listings = []
  mockState.listingForEdit = {
    id: 'listing-1',
    title: 'Original Listing',
    type: 'Internship',
    description: 'Original description',
    stipend: 4500,
    location: 'Johannesburg',
    duration: '12 months',
    closing_date: '2026-07-30',
    status: 'Pending',
  }
  mockState.requirementRow = {
    id: 'requirement-1',
    description: 'Original requirements',
  }
  mockState.updatedOpportunityPayload = null
  mockState.updatedRequirementPayload = null
  mockState.insertedRequirementPayload = null
  mockState.deletedOpportunityIds = []
})

afterEach(() => {
  cleanup()
})

describe('Provider Edit/Delete listing acceptance tests', () => {
  test('1. Edit form renders with existing listing data pre-populated', async () => {
    renderEditPage()

    expect(await screen.findByDisplayValue('Original Listing')).toBeTruthy()
    expect(screen.getByDisplayValue('Internship')).toBeTruthy()
    expect(screen.getByDisplayValue('Original description')).toBeTruthy()
    expect(screen.getByDisplayValue('4500')).toBeTruthy()
    expect(screen.getByDisplayValue('Johannesburg')).toBeTruthy()
    expect(screen.getByDisplayValue('12 months')).toBeTruthy()
    expect(screen.getByDisplayValue('Original requirements')).toBeTruthy()
    expect(screen.getByDisplayValue('2026-07-30')).toBeTruthy()
  })

  test('2. Edit form contains same fields as create form', async () => {
    renderEditPage()

    expect(await screen.findByLabelText('Title')).toBeTruthy()
    expect(screen.getByLabelText('Type')).toBeTruthy()
    expect(screen.getByLabelText('Description')).toBeTruthy()
    expect(screen.getByLabelText('Stipend amount in Rand')).toBeTruthy()
    expect(screen.getByLabelText('Location')).toBeTruthy()
    expect(screen.getByLabelText('Duration')).toBeTruthy()
    expect(screen.getByLabelText('Requirements')).toBeTruthy()
    expect(screen.getByLabelText('Closing date')).toBeTruthy()
  })

  test('3. Saving an edited listing updates the database payload', async () => {
    renderEditPage()

    await screen.findByDisplayValue('Original Listing')
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Updated Listing Title' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(mockState.updatedOpportunityPayload).toBeTruthy()
      expect(mockState.updatedRequirementPayload).toBeTruthy()
    })

    expect(mockState.updatedOpportunityPayload.title).toBe('Updated Listing Title')
    expect(mockState.updatedOpportunityPayload.description).toBe('Original description')
    expect(mockState.updatedRequirementPayload.description).toBe('Original requirements')
  })

  test('4. Updated listing returns to dashboard route without full reload', () => {
    const editPageSource = readFileSync(resolve(cwd(), 'src/pages/ProviderListingEdit.jsx'), 'utf8')

    expect(editPageSource).toContain("navigate('/provider', { replace: true })")
  })

  test('5. Edit form blocks saving when required fields are cleared', async () => {
    renderEditPage()

    await screen.findByDisplayValue('Original Listing')
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Title is required.')).toBeTruthy()
    expect(mockState.updatedOpportunityPayload).toBeNull()
  })

  test('6. Edit form blocks past closing dates before saving', async () => {
    renderEditPage()

    await screen.findByDisplayValue('Original Listing')
    fireEvent.change(screen.getByLabelText('Closing date'), { target: { value: '2000-01-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Closing date cannot be in the past.')).toBeTruthy()
    expect(mockState.updatedOpportunityPayload).toBeNull()
    expect(mockState.updatedRequirementPayload).toBeNull()
  })

  test('6/7/8. Delete asks for confirmation, removes db record, and updates dashboard list', async () => {
    mockState.listings = [
      {
        id: 'listing-delete-1',
        title: 'Delete Me',
        type: 'Learnership',
        stipend: 4000,
        location: 'Cape Town',
        duration: '12 months',
        closing_date: '2026-08-01',
        status: 'Pending',
      },
    ]

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderProviderPage()

    expect(await screen.findByText('Delete Me')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled()
      expect(mockState.deletedOpportunityIds).toContain('listing-delete-1')
      expect(screen.queryByText('Delete Me')).toBeNull()
    })

    confirmSpy.mockRestore()
  })

  test('9. Approved listing edit requires warning confirmation', async () => {
    mockState.listings = [
      {
        id: 'listing-approved-1',
        title: 'Approved Listing',
        type: 'Internship',
        stipend: 6500,
        location: 'Durban',
        duration: '12 months',
        closing_date: '2026-08-10',
        status: 'Approved',
      },
    ]

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderProviderPage()

    expect(await screen.findByText('Approved Listing')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    expect(confirmSpy).toHaveBeenCalledWith(
      'This listing is already approved. Do you want to continue editing it?',
    )

    confirmSpy.mockRestore()
  })

  test('10. Cancelling approved edit confirmation prevents saving changes', async () => {
    mockState.listingForEdit = {
      ...mockState.listingForEdit,
      status: 'Approved',
    }

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderEditPage()

    await screen.findByDisplayValue('Original Listing')
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Blocked Update' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(confirmSpy).toHaveBeenCalledWith(
      'This listing is already approved. Are you sure you want to edit it?',
    )
    expect(mockState.updatedOpportunityPayload).toBeNull()
    expect(mockState.updatedRequirementPayload).toBeNull()

    confirmSpy.mockRestore()
  })

  test('11. Approved listing delete requires warning confirmation', async () => {
    mockState.listings = [
      {
        id: 'listing-approved-2',
        title: 'Approved Delete Listing',
        type: 'Internship',
        stipend: 7000,
        location: 'Durban',
        duration: '12 months',
        closing_date: '2026-08-12',
        status: 'Approved',
      },
    ]

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderProviderPage()

    expect(await screen.findByText('Approved Delete Listing')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(confirmSpy).toHaveBeenCalledWith(
      'This listing is already approved. Deleting it may affect live applicants. Delete anyway?',
    )

    confirmSpy.mockRestore()
  })

  test('12. Provider can only edit or delete their own listings (query constrained by provider_id)', () => {
    const providerSource = readFileSync(resolve(cwd(), 'src/pages/Provider.jsx'), 'utf8')
    const editSource = readFileSync(resolve(cwd(), 'src/pages/ProviderListingEdit.jsx'), 'utf8')

    expect(providerSource).toContain(".eq('provider_id', providerId)")
    expect(editSource).toContain(".eq('provider_id', providerRow.id)")
  })

  test('13. Saving with no requirements row inserts new requirements', async () => {
    mockState.requirementRow = null

    renderEditPage()

    await screen.findByDisplayValue('Original Listing')
    fireEvent.change(screen.getByLabelText('Requirements'), { target: { value: 'Updated requirements text' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(mockState.updatedOpportunityPayload).toBeTruthy()
      expect(mockState.insertedRequirementPayload).toBeTruthy()
    })

    expect(mockState.insertedRequirementPayload.opportunity_id).toBe('listing-1')
    expect(mockState.insertedRequirementPayload.description).toBe('Updated requirements text')
  })

  test('14. Missing provider profile blocks loading the edit form', async () => {
    mockState.providerRow = null

    renderEditPage()

    expect(await screen.findByText('Provider profile was not found.')).toBeTruthy()
    expect(screen.queryByDisplayValue('Original Listing')).toBeNull()
  })

  test('15. Applicant, Admin, and unauthenticated users are blocked by route guard', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('<Route path="/provider/listings/:listingId/edit"')
    expect(appSource).toContain('ProviderWorkspaceRoute')
    expect(appSource).toContain("role !== 'Provider'")
    expect(appSource).toContain('if (!signedIn)')
    expect(appSource).toContain('Navigate to="/"')
  })
})




