import { describe, it, expect, vi } from 'vitest'

// Mutable responses used by the hoisted mock; tests set these per-case
const mockResponses = {}

vi.mock('./lib/supabaseClient', () => ({
  hasSupabaseConfig: true,
  supabase: {
    from: (table) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => mockResponses[table] ?? { data: null },
        }),
      }),
      upsert: () => ({
        select: () => ({ single: async () => mockResponses.upsert ?? { data: null, error: null } }),
      }),
    }),
  },
}))

import * as App from './App'

describe('App supabase helpers', () => {
  it('getRoleForEmail returns role when user exists', async () => {
    mockResponses.users = { data: { role: 'Provider' }, error: null }
    // debug
    // eslint-disable-next-line no-console
    console.log('App keys at test start:', Object.keys(App))
    // eslint-disable-next-line no-console
    console.log('typeof getRoleForEmail:', typeof App.getRoleForEmail, App.getRoleForEmail)
    const role = await App.getRoleForEmail('someone@test.com')
    expect(role).toBe('Provider')
  })

  it('getRoleForEmail throws when fetch error present', async () => {
    mockResponses.users = { data: null, error: new Error('db') }
    await expect(App.getRoleForEmail('fail@test.com')).rejects.toThrow()
  })

  it('getApplicantLandingRouteForEmail returns /profile when no user row', async () => {
    mockResponses.users = { data: null }
    const route = await App.getApplicantLandingRouteForEmail('nouser@test.com')
    expect(route).toBe('/profile')
  })

  it('getApplicantLandingRouteForEmail returns /dashboard when profile complete', async () => {
    mockResponses.users = { data: { id: 42 } }
    mockResponses.applicant_profiles = {
      data: {
        id: 1,
        first_name: 'A',
        last_name: 'B',
        phone: '123',
        location: 'L',
        date_of_birth: '1990-01-01',
        id_number: '987',
        cv_url: 'http://cv',
      },
    }
    const route = await App.getApplicantLandingRouteForEmail('ok@test.com')
    expect(route).toBe('/dashboard')
  })

  it('getProviderLandingRouteForEmail returns /provider/profile when no user', async () => {
    mockResponses.users = { data: null }
    const route = await App.getProviderLandingRouteForEmail('nouser2@test.com')
    expect(route).toBe('/provider/profile')
  })

  it('getProviderLandingRouteForEmail returns provider route when profile exists', async () => {
    mockResponses.users = { data: { id: 7 } }
    mockResponses.provider_profiles = { data: { id: 1, organisation_name: 'X', phone: '1', description: 'desc' } }
    const route = await App.getProviderLandingRouteForEmail('prov@test.com')
    expect(route).toBe('/provider')
  })
})
