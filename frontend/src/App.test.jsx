import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { __mock } from './lib/supabaseClient'

vi.mock('./lib/supabaseClient', () => {
  const authListeners = new Set()
  const usersByEmail = new Map()
  let currentSession = null

  const signInWithOAuth = vi.fn(async () => ({ error: null }))

  const findUserRole = async (email) => {
    const role = usersByEmail.get(email)
    return { data: role ? { role } : null, error: null }
  }

  const insertUserRole = async ({ email, role }) => {
    usersByEmail.set(email, role)
    return { data: { role }, error: null }
  }

  return {
    hasSupabaseConfig: true,
    supabase: {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: currentSession }, error: null })),
        onAuthStateChange: vi.fn((callback) => {
          authListeners.add(callback)
          return {
            data: {
              subscription: {
                unsubscribe: () => authListeners.delete(callback),
              },
            },
          }
        }),
        signOut: vi.fn(async () => {
          currentSession = null
          for (const listener of authListeners) {
            await listener('SIGNED_OUT', null)
          }
          return { error: null }
        }),
        signInWithOAuth,
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn((_, email) => ({
            maybeSingle: vi.fn(async () => findUserRole(email)),
          })),
        })),
        insert: vi.fn((payload) => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => insertUserRole(payload)),
          })),
        })),
      })),
    },
    __mock: {
      reset: () => {
        usersByEmail.clear()
        currentSession = null
        authListeners.clear()
        signInWithOAuth.mockClear()
      },
      setSession: (email) => {
        currentSession = email ? { user: { email } } : null
      },
      emitSignedIn: async (email) => {
        currentSession = { user: { email } }
        for (const listener of authListeners) {
          await listener('SIGNED_IN', currentSession)
        }
      },
      addUser: (email, role) => {
        usersByEmail.set(email, role)
      },
      getUserRole: (email) => usersByEmail.get(email) ?? null,
      getSignInWithOAuthMock: () => signInWithOAuth,
      getCurrentSession: () => currentSession,
    },
  }
})

const seededAdminEmails = ['admin@learnership.co.za', 'moderator@learnership.co.za']

const renderAt = (path = '/') => {
  window.history.pushState({}, '', path)
  return render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
  )
}

const signInAs = async (email) => {
  await act(async () => {
    await __mock.emitSignedIn(email)
  })
}

describe('Admin auth and access flows', () => {
  beforeEach(() => {
    __mock.reset()
    for (const email of seededAdminEmails) {
      __mock.addUser(email, 'Admin')
    }
  })

  afterEach(() => {
    cleanup()
  })

  it('Unauthenticated users cannot access /admin', async () => {
    renderAt('/admin')

    expect(await screen.findByText(/BUILDING TALENT/i)).toBeTruthy()
    expect(window.location.pathname).toBe('/')
    expect(screen.queryByText(/Platform Moderation Console/i)).toBeNull()
  })

  it.each([
    ['Applicant', 'applicant@learnership.co.za'],
    ['Provider', 'provider@learnership.co.za'],
  ])('Wrong role (%s) is redirected away from /admin', async (role, email) => {
    __mock.addUser(email, role)
    __mock.setSession(email)

    renderAt('/admin')

    expect(await screen.findByText(/BUILDING TALENT/i)).toBeTruthy()
    expect(window.location.pathname).toBe('/')
    expect(screen.queryByText(/Platform Moderation Console/i)).toBeNull()
  })

  it('Admin email gets Admin role assigned after Google login', async () => {
    renderAt('/')

    fireEvent.click(await screen.findByRole('button', { name: /Log In with Google/i }))
    expect(__mock.getSignInWithOAuthMock()).toHaveBeenCalledTimes(1)

    await signInAs('admin@learnership.co.za')

    await waitFor(() => {
      expect(window.location.pathname).toBe('/admin')
    })
    expect(await screen.findByText('Admin')).toBeTruthy()
    expect(__mock.getUserRole('admin@learnership.co.za')).toBe('Admin')
  })

  it('Non-admin email never gets the Admin role', async () => {
    const email = 'new.user@learnership.co.za'

    renderAt('/')
    fireEvent.click(await screen.findByRole('button', { name: /Log In with Google/i }))
    await signInAs(email)

    expect(await screen.findByText(new RegExp(`Select how you want to use the platform for ${email}`, 'i'))).toBeTruthy()
    expect(screen.queryByText('Admin')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Applicant' }))

    await waitFor(() => {
      expect(window.location.pathname).toBe('/dashboard')
    })
    expect(await screen.findByText(/Applicant Dashboard/i)).toBeTruthy()
    expect(__mock.getUserRole(email)).toBe('Applicant')
  })

  it('Admin lands on /admin after login', async () => {
    renderAt('/')
    await signInAs('moderator@learnership.co.za')

    await waitFor(() => {
      expect(window.location.pathname).toBe('/admin')
    })
  })

  it('Admin can see the dashboard heading and panel', async () => {
    __mock.setSession('admin@learnership.co.za')
    renderAt('/admin')

    expect(await screen.findByRole('heading', { name: /Platform Moderation Console/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Moderation Queue/i })).toBeTruthy()
  })

  it('Admin session survives a page refresh', async () => {
    __mock.setSession('admin@learnership.co.za')
    const view = renderAt('/admin')

    expect(await screen.findByText(/Platform Moderation Console/i)).toBeTruthy()

    view.unmount()
    renderAt('/admin')

    expect(await screen.findByText(/Platform Moderation Console/i)).toBeTruthy()
    expect(window.location.pathname).toBe('/admin')
  })

  it('Logout from admin clears the session', async () => {
    __mock.setSession('admin@learnership.co.za')
    renderAt('/admin')

    const adminHeader = await screen.findByText(/Signed in as/i)
    fireEvent.click(within(adminHeader.parentElement).getByRole('button', { name: /Logout/i }))

    expect(await screen.findByText(/BUILDING TALENT/i)).toBeTruthy()
    expect(window.location.pathname).toBe('/')
    expect(__mock.getCurrentSession()).toBeNull()
    expect(screen.queryByText(/Platform Moderation Console/i)).toBeNull()
  })

  it('Admin moderation UI has queue, quick actions, and status labels', async () => {
    __mock.setSession('admin@learnership.co.za')
    renderAt('/admin')

    expect(await screen.findByRole('heading', { name: /Moderation Queue/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Quick Actions/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Approve selected listings/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Send provider feedback/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Export moderation report/i })).toBeTruthy()
    expect(screen.getByText(/Needs final compliance check/i)).toBeTruthy()
    expect(screen.getByText(/Duplicate listing detected/i)).toBeTruthy()
    expect(screen.getByText(/Closing date mismatch/i)).toBeTruthy()
  })

  it('Example admin emails exist in the database before login flow', () => {
    expect(__mock.getUserRole('admin@learnership.co.za')).toBe('Admin')
    expect(__mock.getUserRole('moderator@learnership.co.za')).toBe('Admin')
  })
})