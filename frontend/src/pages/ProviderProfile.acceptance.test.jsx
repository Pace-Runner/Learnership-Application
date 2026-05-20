import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProviderProfile from './ProviderProfile'

const mockState = {
  hasSupabaseConfig: true,
  authEmail: 'provider@example.com',
  sessionError: null,
  userRow: { id: 'user-1' },
  userError: null,
  profileRow: {
    id: 'provider-profile-1',
    organisation_name: 'Khayelitsha Skills Centre',
    phone: '0215551000',
    description: 'We support young people into workplace-ready training opportunities.',
  },
  profileError: null,
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
          maybeSingle: vi.fn(async () => ({ data: mockState.userRow, error: mockState.userError })),
        })),
      })),
    }
  }

  if (tableName === 'provider_profiles') {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: mockState.profileRow, error: mockState.profileError })),
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
    get hasSupabaseConfig() {
      return mockState.hasSupabaseConfig
    },
    supabase: {
      auth: {
        getSession: vi.fn(async () => ({
          data: { session: { user: { email: mockState.authEmail } } },
          error: mockState.sessionError,
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
  mockState.sessionError = null
  mockState.userRow = { id: 'user-1' }
  mockState.userError = null
  mockState.profileRow = {
    id: 'provider-profile-1',
    organisation_name: 'Khayelitsha Skills Centre',
    phone: '0215551000',
    description: 'We support young people into workplace-ready training opportunities.',
  }
  mockState.profileError = null
  mockState.hasSupabaseConfig = true
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

    fireEvent.change(await screen.findByLabelText(/Company \/ organisation name/i), {
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
    expect(await screen.findByRole('button', { name: 'Save profile' })).toBeTruthy()
    expect(screen.getByText('Profile preview')).toBeTruthy()
  })

  test('4. Validation errors display when required fields are empty', async () => {
    mockState.profileRow = null
    renderProfilePage()

    await screen.findByText('Build your profile')
    const saveProfileButton = await screen.findByRole('button', { name: 'Save profile' })

    // Try to submit with empty fields
    fireEvent.click(saveProfileButton)

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
    const companyField = await screen.findByLabelText(/Company \/ organisation name/i)

    fireEvent.change(companyField, {
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

    fireEvent.change(await screen.findByLabelText(/Company \/ organisation name/i), {
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
    const saveProfileButton = await screen.findByRole('button', { name: 'Save profile' })

    // Submit with empty fields to trigger validation
    fireEvent.click(saveProfileButton)

    await waitFor(() => {
      expect(screen.getByText(/Company \/ organisation name is required/i)).toBeTruthy()
    })

    // Now fill in the field
    fireEvent.change(await screen.findByLabelText(/Company \/ organisation name/i), {
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
    expect(mockState.updatedProfilePayload.logo_url).toBe('data:image/png;base64,preview-data')
  })

  test('10. A missing provider session shows a sign-in error', async () => {
    mockState.authEmail = ''

    renderProfilePage()

    expect(await screen.findAllByText('You must be signed in as a Provider to edit your profile.')).toHaveLength(2)
  })

  test('11. Missing Supabase config blocks loading the profile', async () => {
    mockState.hasSupabaseConfig = false

    renderProfilePage()

    expect(
      await screen.findAllByText('Supabase is not configured. Provider profiles cannot be loaded right now.'),
    ).toHaveLength(2)
  })

  test('12. Missing provider account details are reported on load', async () => {
    mockState.userRow = null

    renderProfilePage()

    expect(await screen.findAllByText('Provider account details were not found.')).toHaveLength(2)
  })

  test('13. Load errors are mapped to a friendly permission message', async () => {
    mockState.profileError = { code: '42501', message: 'row-level security violation' }

    renderProfilePage()

    expect(
      await screen.findAllByText(
        'You do not have permission to access this provider profile yet. Please check the latest RLS policy.',
      ),
    ).toHaveLength(2)
  })

  test('14. Save is blocked when Supabase config disappears after load', async () => {
    renderProfilePage()

    await screen.findByDisplayValue('Khayelitsha Skills Centre')
    mockState.hasSupabaseConfig = false

    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(
      await screen.findAllByText('Supabase is not configured. Provider profiles cannot be saved yet.'),
    ).toHaveLength(2)
  })

  test('15. Duplicate profile errors are surfaced when updating', async () => {
    mockState.updateError = { code: '23505', message: 'duplicate key value violates unique constraint' }

    renderProfilePage()

    await screen.findByDisplayValue('Khayelitsha Skills Centre')
    fireEvent.change(await screen.findByLabelText(/Company \/ organisation name/i), {
      target: { value: 'Updated Skills Centre' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(
      await screen.findAllByText(
        'A provider profile already exists for this account. Please refresh and try again.',
      ),
    ).toHaveLength(2)
  })

  test('16. Network errors are surfaced when creating a profile', async () => {
    mockState.profileRow = null
    mockState.insertError = { message: 'failed to fetch' }

    renderProfilePage()

    await screen.findByText('Build your profile')

    fireEvent.change(await screen.findByLabelText(/Company \/ organisation name/i), {
      target: { value: 'Ubuntu Training Hub' },
    })
    fireEvent.change(screen.getByLabelText(/Phone number/i), { target: { value: '0821234567' } })
    fireEvent.change(screen.getByLabelText(/About your organisation/i), {
      target: { value: 'We connect applicants to structured workplace learning pathways.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(
      await screen.findAllByText('Network error while saving your profile. Please check your connection and try again.'),
    ).toHaveLength(2)
  })

})
