import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cwd } from 'node:process'
import ProviderProfile from './ProviderProfile'

const mockState = {
  authEmail: 'provider@example.com',
  userRow: { id: 'user-1' },
  profileRow: {
    id: 'provider-profile-1',
    organisation_name: 'Khayelitsha Skills Centre',
    phone: '0215551000',
    description: 'We support young people into workplace-ready training opportunities.',
  },
  insertedProfilePayload: null,
  updatedProfilePayload: null,
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
          maybeSingle: vi.fn(async () => ({ data: mockState.profileRow, error: null })),
        })),
      })),
      insert: vi.fn((payload) => {
        mockState.insertedProfilePayload = payload

        return {
          select: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: { id: 'provider-profile-2', ...payload },
              error: null,
            })),
          })),
        }
      }),
      update: vi.fn((payload) => {
        mockState.updatedProfilePayload = payload

        return {
          eq: vi.fn(async () => ({ error: null })),
        }
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

function renderProfilePage() {
  return render(
    <MemoryRouter>
      <ProviderProfile onLogout={vi.fn()} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockState.authEmail = 'provider@example.com'
  mockState.userRow = { id: 'user-1' }
  mockState.profileRow = {
    id: 'provider-profile-1',
    organisation_name: 'Khayelitsha Skills Centre',
    phone: '0215551000',
    description: 'We support young people into workplace-ready training opportunities.',
  }
  mockState.insertedProfilePayload = null
  mockState.updatedProfilePayload = null
})

afterEach(() => {
  cleanup()
})

describe('Provider profile acceptance tests', () => {
  test('1. Provider profile page renders saved profile information from Supabase', async () => {
    renderProfilePage()

    expect(await screen.findByDisplayValue('Khayelitsha Skills Centre')).toBeTruthy()
    expect(screen.getByDisplayValue('0215551000')).toBeTruthy()
    expect(screen.getByDisplayValue('We support young people into workplace-ready training opportunities.')).toBeTruthy()
    expect(screen.getByText('Saved profile')).toBeTruthy()
    expect(screen.getByText('Khayelitsha Skills Centre')).toBeTruthy()
  })

  test('2. Provider profile form saves to provider_profiles and updates the visible summary', async () => {
    mockState.profileRow = null
    renderProfilePage()

    await screen.findByText('Profile form')

    fireEvent.change(screen.getByLabelText('Company / organisation name'), {
      target: { value: 'Ubuntu Training Hub' },
    })
    fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '0821234567' } })
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'We connect applicants to structured workplace learning pathways.' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save provider profile' }))

    await waitFor(() => expect(mockState.insertedProfilePayload).toBeTruthy())
    expect(mockState.insertedProfilePayload.user_id).toBe('user-1')
    expect(mockState.insertedProfilePayload.organisation_name).toBe('Ubuntu Training Hub')
    expect(mockState.insertedProfilePayload.phone).toBe('0821234567')
    expect(mockState.insertedProfilePayload.description).toBe(
      'We connect applicants to structured workplace learning pathways.',
    )
    expect(await screen.findByText('Provider profile saved successfully.')).toBeTruthy()
    expect(screen.getByText('Ubuntu Training Hub')).toBeTruthy()
    expect(screen.getByText('0821234567')).toBeTruthy()
  })
})