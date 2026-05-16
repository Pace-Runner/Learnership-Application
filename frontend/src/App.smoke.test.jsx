import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Mock supabase client to simulate missing configuration
vi.mock('./lib/supabaseClient', () => ({
  hasSupabaseConfig: false,
  supabase: {
    auth: { getSession: async () => ({ data: { session: null } }) },
  },
}))

import App from './App'

describe('App smoke', () => {
  test('shows missing supabase error when not configured', async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/Missing Supabase environment variables/i)).toBeInTheDocument()
  })
})
