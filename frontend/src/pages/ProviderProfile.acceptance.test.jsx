import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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
  insertError: null,
  updateError: null,
  logoUploadError: null,
  logoPublicUrl: 'https://cdn.example.com/provider-logo.png',
  uploadedLogoPath: null,
  uploadedLogoFile: null,
  publicUrlRequestedPath: null,
}

let originalFileReader = globalThis.FileReader

class MockFileReader {
  constructor() {
    this.onload = null
  }

  readAsDataURL() {
    if (this.onload) {
      this.onload({ target: { result: 'data:image/png;base64,preview-data' } })
    }
  }
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
              data: mockState.insertError ? null : { id: 'provider-profile-2', ...payload },
              error: mockState.insertError,
            })),
          })),
        }
      }),
      update: vi.fn((payload) => {
        mockState.updatedProfilePayload = payload

        return {
          eq: vi.fn(async () => ({ error: mockState.updateError })),
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
      storage: {
        from: vi.fn((bucketName) => {
          if (bucketName !== 'provider_logos') {
            return {
              upload: vi.fn(async () => ({ error: null })),
              getPublicUrl: vi.fn(() => ({ data: { publicUrl: '' } })),
            }
          }

          return {
            upload: vi.fn(async (path, file) => {
              mockState.uploadedLogoPath = path
              mockState.uploadedLogoFile = file

              return { error: mockState.logoUploadError }
            }),
            getPublicUrl: vi.fn((path) => {
              mockState.publicUrlRequestedPath = path

              return { data: { publicUrl: mockState.logoPublicUrl } }
            }),
          }
        }),
      },
    },
  }
})

function renderProfilePage(onProfileSaved = vi.fn()) {
  return render(
    <MemoryRouter>
      <ProviderProfile onLogout={vi.fn()} onProfileSaved={onProfileSaved} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  originalFileReader = globalThis.FileReader
  globalThis.FileReader = MockFileReader
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
  mockState.insertError = null
  mockState.updateError = null
  mockState.logoUploadError = null
  mockState.logoPublicUrl = 'https://cdn.example.com/provider-logo.png'
  mockState.uploadedLogoPath = null
  mockState.uploadedLogoFile = null
  mockState.publicUrlRequestedPath = null
})

afterEach(() => {
  globalThis.FileReader = originalFileReader
  cleanup()
})

describe('Provider profile acceptance tests', () => {
  test('1. Provider profile page renders saved profile information from Supabase', async () => {
    renderProfilePage()

    expect(await screen.findByDisplayValue('Khayelitsha Skills Centre')).toBeTruthy()
    expect(screen.getByDisplayValue('0215551000')).toBeTruthy()
    expect(screen.getByDisplayValue('We support young people into workplace-ready training opportunities.')).toBeTruthy()
    expect(screen.getByText('Build your profile')).toBeTruthy()
    expect(screen.getByText('Profile preview')).toBeTruthy()
    expect(screen.getAllByText('Khayelitsha Skills Centre').length).toBeGreaterThan(0)
  })

  test('2. Provider profile form saves to provider_profiles and updates the visible summary', async () => {
    mockState.profileRow = null
    const onProfileSaved = vi.fn()

    renderProfilePage(onProfileSaved)

    await screen.findByText('Build your profile')

    fireEvent.change(screen.getByLabelText(/Company \/ organisation name/i), {
      target: { value: 'Ubuntu Training Hub' },
    })
    fireEvent.change(screen.getByLabelText(/Phone number/i), { target: { value: '0821234567' } })
    fireEvent.change(screen.getByLabelText(/About your organisation/i), {
      target: { value: 'We connect applicants to structured workplace learning pathways.' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))

    await waitFor(() => expect(mockState.insertedProfilePayload).toBeTruthy())
    expect(mockState.insertedProfilePayload.user_id).toBe('user-1')
    expect(mockState.insertedProfilePayload.organisation_name).toBe('Ubuntu Training Hub')
    expect(mockState.insertedProfilePayload.phone).toBe('0821234567')
    expect(mockState.insertedProfilePayload.description).toBe(
      'We connect applicants to structured workplace learning pathways.',
    )
    expect(await screen.findAllByText('Provider profile saved successfully.')).toHaveLength(2)
    expect(screen.getByText('Profile preview')).toBeTruthy()
    expect(screen.getAllByText('Ubuntu Training Hub').length).toBeGreaterThan(0)
    expect(screen.getAllByText('0821234567').length).toBeGreaterThan(0)
    expect(onProfileSaved).toHaveBeenCalledTimes(1)
    expect(onProfileSaved.mock.calls[0][0]).toEqual({
      organisation_name: 'Ubuntu Training Hub',
      phone: '0821234567',
      description: 'We connect applicants to structured workplace learning pathways.',
    })
  })

  test('3. Provider profile route stays accessible for editing after completion', async () => {
    renderProfilePage()

    expect(await screen.findByText('Build your profile')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save profile' })).toBeTruthy()
    expect(screen.getByText('Profile preview')).toBeTruthy()
  })

  test('4. Validation errors display when required fields are empty', async () => {
    mockState.profileRow = null
    renderProfilePage()

    await screen.findByText('Build your profile')

    // Try to submit with empty fields
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))

    // Should see validation error messages
    await waitFor(() => {
      expect(screen.getByText(/Company \/ organisation name is required/i)).toBeTruthy()
      expect(screen.getByText(/Phone number is required/i)).toBeTruthy()
      expect(screen.getByText(/Description is required/i)).toBeTruthy()
    })
  })

  test('5. Invalid phone number shows validation error', async () => {
    mockState.profileRow = null
    renderProfilePage()

    await screen.findByText('Build your profile')

    fireEvent.change(screen.getByLabelText(/Company \/ organisation name/i), {
      target: { value: 'Test Org' },
    })
    fireEvent.change(screen.getByLabelText(/Phone number/i), { target: { value: 'invalid' } })
    fireEvent.change(screen.getByLabelText(/About your organisation/i), {
      target: { value: 'Description' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))

    await waitFor(() => {
      expect(screen.getByText(/Enter a valid phone number/i)).toBeTruthy()
    })
  })

  test('6. Profile update path persists changes to existing profile', async () => {
    const onProfileSaved = vi.fn()
    renderProfilePage(onProfileSaved)

    await screen.findByDisplayValue('Khayelitsha Skills Centre')

    fireEvent.change(screen.getByLabelText(/Company \/ organisation name/i), {
      target: { value: 'Updated Skills Centre' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))

    await waitFor(() => expect(mockState.updatedProfilePayload).toBeTruthy())
    expect(mockState.updatedProfilePayload.organisation_name).toBe('Updated Skills Centre')
  })

  test('7. Field error clears when user changes the field', async () => {
    mockState.profileRow = null
    renderProfilePage()

    await screen.findByText('Build your profile')

    // Submit with empty fields to trigger validation
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))

    await waitFor(() => {
      expect(screen.getByText(/Company \/ organisation name is required/i)).toBeTruthy()
    })

    // Now fill in the field
    fireEvent.change(screen.getByLabelText(/Company \/ organisation name/i), {
      target: { value: 'Test Org' },
    })

    // Error should disappear
    await waitFor(() => {
      expect(screen.queryByText(/Company \/ organisation name is required/i)).toBeFalsy()
    })
  })

  test('8. Logo upload is persisted when saving an existing profile', async () => {
    renderProfilePage()

    await screen.findByDisplayValue('Khayelitsha Skills Centre')

    const logoInput = document.getElementById('provider-logo')
    fireEvent.change(logoInput, {
      target: { files: [new File(['logo'], 'provider-logo.png', { type: 'image/png' })] },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))

    await waitFor(() => expect(mockState.updatedProfilePayload).toBeTruthy())
    expect(mockState.uploadedLogoPath).toMatch(/^user-1-\d+-provider-logo\.png$/)
    expect(mockState.uploadedLogoFile?.name).toBe('provider-logo.png')
    expect(mockState.publicUrlRequestedPath).toBe(mockState.uploadedLogoPath)
    expect(mockState.updatedProfilePayload.logo_url).toBe(mockState.logoPublicUrl)
  })

  test('9. Logo upload failure still saves the profile with the preview data', async () => {
    mockState.logoUploadError = { message: 'storage unavailable' }

    renderProfilePage()

    await screen.findByDisplayValue('Khayelitsha Skills Centre')

    const logoInput = document.getElementById('provider-logo')
    fireEvent.change(logoInput, {
      target: { files: [new File(['logo'], 'provider-logo.png', { type: 'image/png' })] },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))

    await waitFor(() => expect(mockState.updatedProfilePayload).toBeTruthy())
    expect(mockState.uploadedLogoPath).toMatch(/^user-1-\d+-provider-logo\.png$/)
    expect(mockState.publicUrlRequestedPath).toBeNull()
    expect(mockState.updatedProfilePayload.logo_url).toBe('data:image/png;base64,preview-data')
  })

})