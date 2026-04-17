import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cwd } from 'node:process'
import Provider from './Provider'
import ProviderListingForm from './ProviderListingForm'
import Dashboard from './Dashboard'

const mockState = {
  authEmail: 'provider@example.com',
  usersRow: { id: 'user-1' },
  providerRow: { id: 'provider-1' },
  opportunitiesRows: [],
  opportunityInsertResult: { id: 'opportunity-1' },
  opportunityRequirementsError: null,
  insertedOpportunityPayload: null,
  insertedRequirementsPayload: null,
}

function buildTableQuery(tableName) {
  if (tableName === 'nqf_qualifications') {
    return {
      select: vi.fn(() => ({
        order: vi.fn(async () => ({
          data: [
            { id: 'qual-1', title: 'Business Administration', nqf_level: 4, saqa_id: 'SAQA-001' },
            { id: 'qual-2', title: 'IT Support', nqf_level: 5, saqa_id: 'SAQA-002' },
          ],
          error: null,
        })),
      })),
    }
  }

  if (tableName === 'users') {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: mockState.usersRow, error: null })),
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
          order: vi.fn(async () => ({ data: mockState.opportunitiesRows, error: null })),
        })),
      })),
      insert: vi.fn((payload) => {
        mockState.insertedOpportunityPayload = payload
        return {
          select: vi.fn(() => ({
            single: vi.fn(async () => ({ data: mockState.opportunityInsertResult, error: null })),
          })),
        }
      }),
      delete: vi.fn(() => ({
        eq: vi.fn(async () => ({ data: null, error: null })),
      })),
    }
  }

  if (tableName === 'opportunity_requirements') {
    return {
      insert: vi.fn(async (payload) => {
        mockState.insertedRequirementsPayload = payload
        return { data: null, error: mockState.opportunityRequirementsError }
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

function renderListingForm() {
  return render(
    <MemoryRouter>
      <ProviderListingForm />
    </MemoryRouter>,
  )
}

function getFutureDate() {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  return date.toISOString().slice(0, 10)
}

function getPastDate() {
  const date = new Date()
  date.setDate(date.getDate() - 7)
  return date.toISOString().slice(0, 10)
}

async function fillValidForm() {
  fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Data Analyst Internship' } })
  fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'Internship' } })
  fireEvent.change(screen.getByLabelText('Description'), {
    target: { value: 'Work with the BI team to improve dashboards.' },
  })
  fireEvent.change(screen.getByLabelText('Stipend'), { target: { value: '4500' } })
  fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Johannesburg' } })
  fireEvent.change(screen.getByLabelText('Duration'), { target: { value: '12 months' } })
  fireEvent.change(screen.getByLabelText('Qualification'), { target: { value: 'qual-1' } })
  fireEvent.change(screen.getByLabelText('NQF level required'), { target: { value: '4' } })
  fireEvent.change(screen.getByLabelText('Requirements'), {
    target: { value: 'NQF level 4, basic spreadsheet skills' },
  })
  fireEvent.change(screen.getByLabelText('Closing date'), { target: { value: getFutureDate() } })
}

beforeEach(() => {
  mockState.authEmail = 'provider@example.com'
  mockState.usersRow = { id: 'user-1' }
  mockState.providerRow = { id: 'provider-1' }
  mockState.opportunitiesRows = []
  mockState.opportunityInsertResult = { id: 'opportunity-1' }
  mockState.opportunityRequirementsError = null
  mockState.insertedOpportunityPayload = null
  mockState.insertedRequirementsPayload = null
})

afterEach(() => {
  cleanup()
})

describe('Provider Post a Listing acceptance tests', () => {
  test('1. Listing form renders all required fields', () => {
    renderListingForm()

    expect(screen.getByLabelText('Title')).toBeTruthy()
    expect(screen.getByLabelText('Type')).toBeTruthy()
    expect(screen.getByLabelText('Description')).toBeTruthy()
    expect(screen.getByLabelText('Stipend')).toBeTruthy()
    expect(screen.getByLabelText('Location')).toBeTruthy()
    expect(screen.getByLabelText('Duration')).toBeTruthy()
    expect(screen.getByLabelText('Qualification')).toBeTruthy()
    expect(screen.getByLabelText('NQF level required')).toBeTruthy()
    expect(screen.getByLabelText('Requirements')).toBeTruthy()
    expect(screen.getByLabelText('Closing date')).toBeTruthy()
  })

  test('2. Listing type dropdown contains the correct options', () => {
    renderListingForm()

    const typeSelect = screen.getByLabelText('Type')
    const optionValues = Array.from(typeSelect.querySelectorAll('option'))
      .map((option) => option.textContent)
      .filter(Boolean)

    expect(optionValues).toEqual(['Learnership', 'Internship', 'Apprenticeship'])
  })

  test('3. Listing form blocks submission when required fields are empty', async () => {
    renderListingForm()

    fireEvent.click(screen.getByRole('button', { name: 'Submit listing' }))

    expect(await screen.findByText('Title is required.')).toBeTruthy()
    expect(screen.getByText('Description is required.')).toBeTruthy()
    expect(screen.getByText('Qualification is required.')).toBeTruthy()
    expect(screen.getByText('NQF level is required.')).toBeTruthy()
    expect(screen.getByText('Requirements are required.')).toBeTruthy()
  })

  test('4. Closing date field rejects past dates', async () => {
    renderListingForm()

    await fillValidForm()
    fireEvent.change(screen.getByLabelText('Closing date'), { target: { value: getPastDate() } })

    fireEvent.click(screen.getByRole('button', { name: 'Submit listing' }))

    expect(await screen.findByText('Closing date cannot be in the past.')).toBeTruthy()
    expect(mockState.insertedOpportunityPayload).toBeNull()
  })

  test('5/6/7. Successful submission saves listing, sets Pending, and links the signed-in provider', async () => {
    renderListingForm()

    await waitFor(() => {
      expect(screen.queryByText('Loading qualification options...')).toBeNull()
    })

    await fillValidForm()
    fireEvent.click(screen.getByRole('button', { name: 'Submit listing' }))

    await waitFor(() => {
      expect(mockState.insertedOpportunityPayload).toBeTruthy()
      expect(mockState.insertedRequirementsPayload).toBeTruthy()
    })

    expect(mockState.insertedOpportunityPayload.title).toBe('Data Analyst Internship')
    expect(mockState.insertedOpportunityPayload.type).toBe('Internship')
    expect(mockState.insertedOpportunityPayload.description).toBe(
      'Work with the BI team to improve dashboards.',
    )
    expect(mockState.insertedOpportunityPayload.stipend).toBe(4500)
    expect(mockState.insertedOpportunityPayload.location).toBe('Johannesburg')
    expect(mockState.insertedOpportunityPayload.duration).toBe('12 months')
    expect(mockState.insertedOpportunityPayload.status).toBe('Pending')
    expect(mockState.insertedOpportunityPayload.provider_id).toBe('provider-1')
    expect(mockState.insertedRequirementsPayload.description).toBe(
      'NQF level 4, basic spreadsheet skills',
    )
    expect(mockState.insertedRequirementsPayload.nqf_level_required).toBe(4)
  })

  test('8/9. Submitted listings appear in provider dashboard with visible Pending status', async () => {
    mockState.opportunitiesRows = [
      {
        id: 'listing-123',
        title: 'Data Analyst Internship',
        type: 'Internship',
        location: 'Johannesburg',
        duration: '12 months',
        closing_date: getFutureDate(),
        status: 'Pending',
      },
    ]

    render(
      <MemoryRouter>
        <Provider onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Data Analyst Internship')).toBeTruthy()
    expect(screen.getByText('Status: Pending')).toBeTruthy()
  })

  test('10. Provider cannot submit listing with invalid stipend', async () => {
    renderListingForm()

    await fillValidForm()
    fireEvent.change(screen.getByLabelText('Stipend'), { target: { value: '-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit listing' }))

    expect(await screen.findByText('Stipend must be a positive number.')).toBeTruthy()
    expect(mockState.insertedOpportunityPayload).toBeNull()
  })

  test('11. Listing does not appear in applicant search before approval', () => {
    const listings = [
      { id: 'pending-1', title: 'Pending Listing', status: 'Pending' },
      { id: 'approved-1', title: 'Approved Listing', status: 'Approved' },
    ]

    render(
      <MemoryRouter>
        <Dashboard onLogout={vi.fn()} listings={listings} />
      </MemoryRouter>,
    )

    expect(screen.queryByText('Pending Listing')).toBeNull()
    expect(screen.getByText('Approved Listing')).toBeTruthy()
  })

  test('12/13. Listing page access is restricted to signed-in Provider role by route guard', () => {
    const appSource = readFileSync(resolve(cwd(), 'src/App.jsx'), 'utf8')

    expect(appSource).toContain('<Route path="/provider/listings/new"')
    expect(appSource).toContain('allowedRole="Provider"')
    expect(appSource).toContain('if (!signedIn)')
    expect(appSource).toContain('if (role !== allowedRole)')
    expect(appSource).toContain('Navigate to="/"')
  })
})
