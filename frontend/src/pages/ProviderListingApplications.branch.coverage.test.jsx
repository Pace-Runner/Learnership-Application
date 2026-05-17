import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const mockFrom = vi.fn()
const mockStorageFrom = vi.fn()
const mockInvoke = vi.fn()

afterEach(() => {
  cleanup()
  vi.resetModules()
  vi.clearAllMocks()
})

describe('ProviderListingApplications branch coverage', () => {
  it('shows the config error when Supabase is missing', async () => {
    vi.doMock('../lib/supabaseClient', () => ({
      hasSupabaseConfig: false,
      supabase: {
        auth: { getSession: vi.fn() },
        from: mockFrom,
        storage: { from: mockStorageFrom },
        functions: { invoke: mockInvoke },
      },
    }))

    const { default: ProviderListingApplications } = await import('./ProviderListingApplications')

    render(
      <MemoryRouter initialEntries={['/provider/listings/listing-1/applications']}>
        <Routes>
          <Route path="/provider/listings/:listingId/applications" element={<ProviderListingApplications />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText(/Supabase not configured/i)).toBeTruthy()
  })

  it('shows the provider sign-in error when no session is available', async () => {
    vi.doMock('../lib/supabaseClient', () => ({
      hasSupabaseConfig: true,
      supabase: {
        auth: {
          getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
        },
        from: mockFrom,
        storage: { from: mockStorageFrom },
        functions: { invoke: mockInvoke },
      },
    }))

    const { default: ProviderListingApplications } = await import('./ProviderListingApplications')

    render(
      <MemoryRouter initialEntries={['/provider/listings/listing-1/applications']}>
        <Routes>
          <Route path="/provider/listings/:listingId/applications" element={<ProviderListingApplications />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText(/You must be signed in as a Provider to view applicants\./i)).toBeTruthy()
  })

  it('shows an error when the provider user record is missing', async () => {
    vi.doMock('../lib/supabaseClient', () => ({
      hasSupabaseConfig: true,
      supabase: {
        auth: {
          getSession: vi.fn(async () => ({ data: { session: { user: { email: 'provider@example.com' } } }, error: null })),
        },
        from: mockFrom,
        storage: { from: mockStorageFrom },
        functions: { invoke: mockInvoke },
      },
    }))

    // users query returns no row
    mockFrom.mockImplementation((table) => {
      if (table === 'users') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }
      }

      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }
    })

    const { default: ProviderListingApplications } = await import('./ProviderListingApplications')

    render(
      <MemoryRouter initialEntries={['/provider/listings/listing-1/applications']}>
        <Routes>
          <Route path="/provider/listings/:listingId/applications" element={<ProviderListingApplications />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText(/Provider user record was not found\./i)).toBeTruthy()
  })

  it('shows an error when the provider profile is missing', async () => {
    vi.doMock('../lib/supabaseClient', () => ({
      hasSupabaseConfig: true,
      supabase: {
        auth: {
          getSession: vi.fn(async () => ({ data: { session: { user: { email: 'provider@example.com' } } }, error: null })),
        },
        from: mockFrom,
        storage: { from: mockStorageFrom },
        functions: { invoke: mockInvoke },
      },
    }))

    mockFrom.mockImplementation((table) => {
      if (table === 'users') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'provider-user-1' }, error: null }) }) }) }
      }

      if (table === 'provider_profiles') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }
      }

      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }
    })

    const { default: ProviderListingApplications } = await import('./ProviderListingApplications')

    render(
      <MemoryRouter initialEntries={['/provider/listings/listing-1/applications']}>
        <Routes>
          <Route path="/provider/listings/:listingId/applications" element={<ProviderListingApplications />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText(/Provider profile was not found\./i)).toBeTruthy()
  })

  it('shows an error when listing is not found or permission denied', async () => {
    vi.doMock('../lib/supabaseClient', () => ({
      hasSupabaseConfig: true,
      supabase: {
        auth: {
          getSession: vi.fn(async () => ({ data: { session: { user: { email: 'provider@example.com' } } }, error: null })),
        },
        from: mockFrom,
        storage: { from: mockStorageFrom },
        functions: { invoke: mockInvoke },
      },
    }))

    mockFrom.mockImplementation((table) => {
      if (table === 'users') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'provider-user-1' }, error: null }) }) }) }
      }

      if (table === 'provider_profiles') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'provider-profile-1' }, error: null }) }) }) }
      }

      if (table === 'opportunities') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'listing-1', provider_id: 'different-provider' }, error: null }) }) }) }
      }

      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }
    })

    const { default: ProviderListingApplications } = await import('./ProviderListingApplications')

    render(
      <MemoryRouter initialEntries={['/provider/listings/listing-1/applications']}>
        <Routes>
          <Route path="/provider/listings/:listingId/applications" element={<ProviderListingApplications />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText(/Listing not found or you do not have permission to view it\./i)).toBeTruthy()
  })

  it('shows an RLS error when applications cannot be loaded', async () => {
    vi.doMock('../lib/supabaseClient', () => ({
      hasSupabaseConfig: true,
      supabase: {
        auth: {
          getSession: vi.fn(async () => ({ data: { session: { user: { email: 'provider@example.com' } } }, error: null })),
        },
        from: mockFrom,
        storage: { from: mockStorageFrom },
        functions: { invoke: mockInvoke },
      },
    }))

    mockFrom.mockImplementation((table) => {
      if (table === 'users') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'provider-user-1' }, error: null }) }) }) }
      }

      if (table === 'provider_profiles') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'provider-profile-1' }, error: null }) }) }) }
      }

      if (table === 'opportunities') {
        return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'listing-1', provider_id: 'provider-profile-1' }, error: null }) }) }) }
      }

      if (table === 'applications') {
        return { select: () => ({ eq: () => ({ order: async () => ({ data: null, error: { message: 'RLS' } }) }) }) }
      }

      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }
    })

    const { default: ProviderListingApplications } = await import('./ProviderListingApplications')

    render(
      <MemoryRouter initialEntries={['/provider/listings/listing-1/applications']}>
        <Routes>
          <Route path="/provider/listings/:listingId/applications" element={<ProviderListingApplications />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText(/Could not load applications\. Check RLS policies\./i)).toBeTruthy()
  })
})
