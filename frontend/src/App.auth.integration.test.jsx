import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

describe('App auth flows', () => {
  it('Clicking Google sign-in shows auth error when signInWithOAuth fails', async () => {
    vi.resetModules()

    const mockSignIn = vi.fn(async () => ({ error: new Error('sign-in-failed') }))

    vi.doMock('./lib/supabaseClient', () => ({
      hasSupabaseConfig: true,
      supabase: {
        auth: {
          signInWithOAuth: mockSignIn,
          getSession: async () => ({ data: { session: null }, error: null }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        },
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
      },
    }))

    const { default: App } = await import('./App')

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )

    const button = await screen.findByRole('button', { name: /Log In with Google/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText(/Google sign-in failed/i)).toBeTruthy()
    })
  })
})
