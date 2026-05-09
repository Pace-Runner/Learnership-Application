// Main app: handles Google OAuth, role-based routing, and admin dashboard
// TRICKY PARTS:
// - OAuth flow: Google login → email lookup → role selection (if new user)
// - Session persistence: browser cookies restored on page refresh
// - Route guards: ProtectedRoute blocks unauthorized access
// - State management: tracking auth, loading, roles, and pending signups
// - 3D animation: particle effect that reacts to mouse movement

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'
import Admin from './pages/Admin'
import Dashboard from './pages/Dashboard'
import ApplicantProfile from './pages/ApplicantProfile'
import ApplicantListingDetail from './pages/ApplicantListingDetail'
import Provider from './pages/Provider'
import ProviderListingForm from './pages/ProviderListingForm'
import ProviderListingEdit from './pages/ProviderListingEdit'
import ProviderListingApplications from './pages/ProviderListingApplications'
import { hasSupabaseConfig, supabase } from './lib/supabaseClient'
const AdminDashboardShell = Admin

// ProtectedRoute: Guard component that restricts access to role-specific pages
// USAGE: <ProtectedRoute role={role} allowedRole="Admin" signedIn={signedIn} isLoading={isLoadingAuth}><Admin /></ProtectedRoute>
// LOGIC:
// 1. If still checking auth → show loading shell (don't flash wrong page)
// 2. If not signed in → redirect to home (must log in)
// 3. If wrong role → redirect to home (prevent unauthorized access)
// 4. All checks pass → render the protected content
function ProtectedRoute({ role, allowedRole, signedIn, isLoading, children }) {
  const location = useLocation()

  // Show loading state while session is being verified from browser cookies
  if (isLoading) {
    return (
      <main className="auth-loading-shell" aria-busy="true" aria-live="polite">
        <p>Checking your session...</p>
      </main>
    )
  }

  // Unauthenticated users cannot access protected routes
  if (!signedIn) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  // Role mismatch: user is logged in but lacks permission for this page
  // Example: Applicant (role="Applicant") trying to access /admin (allowedRole="Admin")
  if (role !== allowedRole) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  // All security checks passed: render the page
  return children
}

// Redirect logic: where should each role go after logging in?
function getLandingRoute(role) {
  if (role === 'Admin') return '/admin'
  if (role === 'Provider') return '/provider'
  return '/dashboard'
}

function isApplicantProfileComplete(profile) {
  return Boolean(
    profile?.id
      && profile?.first_name?.trim()
      && profile?.last_name?.trim()
      && profile?.phone?.trim()
      && profile?.location?.trim()
      && profile?.date_of_birth
      && profile?.id_number?.trim()
      && profile?.cv_url?.trim(),
  )
}

function App() {
  // Authentication state management:
  const [role, setRole] = useState(null) // Current user's role: 'Admin', 'Provider', 'Applicant', or null
  const [signedIn, setSignedIn] = useState(false) // True if OAuth session is active
  const [isLoadingAuth, setIsLoadingAuth] = useState(true) // True while checking session from browser cookies
  const [authError, setAuthError] = useState('') // Display auth errors to user
  const [pendingEmail, setPendingEmail] = useState('') // New user email waiting for role selection
  const [isSavingRole, setIsSavingRole] = useState(false) // True while inserting user into database
  const [applicantLandingRoute, setApplicantLandingRoute] = useState('/dashboard')
  const oauthTimeoutRef = useRef(null)

  // Animation state for the 3D particle effect
  const [pointer, setPointer] = useState({ x: 0, y: 0 })
  const [isScrolled, setIsScrolled] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const oauthRedirectTo =
    import.meta.env.VITE_AUTH_REDIRECT_URL?.trim() || `${window.location.origin}/`

  const clearOAuthTimeout = useCallback(() => {
    if (oauthTimeoutRef.current) {
      window.clearTimeout(oauthTimeoutRef.current)
      oauthTimeoutRef.current = null
    }
  }, [])

  // Query users table to get applicant/provider/admin role based on email
  const getRoleForEmail = useCallback(async (email) => {
    // Query users table: find role by email address
    const { data: userRecord, error: fetchError } = await supabase
      .from('users')
      .select('role')
      .eq('email', email)
      .maybeSingle() // null if no match

    if (fetchError) {
      throw fetchError
    }

    return userRecord?.role ?? null
  }, [])

  const getApplicantLandingRouteForEmail = useCallback(async (email) => {
    if (!hasSupabaseConfig || !email) {
      return '/profile'
    }

    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (!userRow?.id) {
      return '/profile'
    }

    const { data: profileRow } = await supabase
      .from('applicant_profiles')
      .select('id,first_name,last_name,phone,location,date_of_birth,id_number,cv_url')
      .eq('user_id', userRow.id)
      .maybeSingle()

    return isApplicantProfileComplete(profileRow) ? '/dashboard' : '/profile'
  }, [])

  // AUTH BOOTSTRAP: Restore user session on app load and listen for auth changes
  // FLOW:
  // 1. Check if session exists in browser cookies (user already logged in before)
  // 2. Lookup user's role in database by email
  // 3. Set up listener to detect sign-in/sign-out events
  // 4. When sign-in happens, role lookup and optional role selection for new users
  // WHY: Ensures app state matches Supabase auth session, prevents stale data on refresh
  useEffect(() => {
    let isMounted = true

    const initializeAuth = async () => {
      setIsLoadingAuth(true)

      if (!hasSupabaseConfig) {
        if (isMounted) {
          setAuthError('Missing Supabase environment variables. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
          setSignedIn(false)
          setRole(null)
          setIsLoadingAuth(false)
        }
        return
      }

      const { data, error } = await supabase.auth.getSession()

      if (error) {
        if (isMounted) {
          setAuthError('Unable to restore your session. Please sign in again.')
          setSignedIn(false)
          setRole(null)
          setIsLoadingAuth(false)
        }
        return
      }

      const existingSession = data.session

      if (!existingSession?.user?.email) {
        if (isMounted) {
          setSignedIn(false)
          setRole(null)
          setApplicantLandingRoute('/dashboard')
          setIsLoadingAuth(false)
        }
        return
      }

      try {
        const resolvedRole = await getRoleForEmail(existingSession.user.email)
        const resolvedLandingRoute =
          resolvedRole === 'Applicant'
            ? await getApplicantLandingRouteForEmail(existingSession.user.email)
            : getLandingRoute(resolvedRole)
        if (isMounted) {
          setSignedIn(true)
          setRole(resolvedRole)
          setPendingEmail(resolvedRole ? '' : existingSession.user.email)
          setApplicantLandingRoute(resolvedLandingRoute)
          setAuthError('')
        }
      } catch {
        if (isMounted) {
          setSignedIn(false)
          setRole(null)
          setApplicantLandingRoute('/dashboard')
          setAuthError('Signed in, but role lookup failed. Check your users table and policies.')
        }
      } finally {
        if (isMounted) {
          setIsLoadingAuth(false)
        }
      }
    }

    initializeAuth()

    if (!hasSupabaseConfig) {
      return () => {
        isMounted = false
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) {
        return
      }

      if (event === 'SIGNED_OUT' || !session?.user?.email) {
        clearOAuthTimeout()
        setSignedIn(false)
        setRole(null)
        setPendingEmail('')
        setIsSavingRole(false)
        setApplicantLandingRoute('/dashboard')
        setIsLoadingAuth(false)
        return
      }

      try {
        const resolvedRole = await getRoleForEmail(session.user.email)
        const resolvedLandingRoute =
          resolvedRole === 'Applicant'
            ? await getApplicantLandingRouteForEmail(session.user.email)
            : getLandingRoute(resolvedRole)
        if (!isMounted) {
          return
        }
        clearOAuthTimeout()
        setSignedIn(true)
        setRole(resolvedRole)
        setPendingEmail(resolvedRole ? '' : session.user.email)
        setApplicantLandingRoute(resolvedLandingRoute)
        setAuthError('')
      } catch {
        if (!isMounted) {
          return
        }
        setSignedIn(false)
        setRole(null)
        setApplicantLandingRoute('/dashboard')
        setAuthError('OAuth succeeded, but role lookup failed. Please verify Supabase table policies.')
      } finally {
        if (isMounted) {
          clearOAuthTimeout()
          setIsLoadingAuth(false)
        }
      }
    })

    return () => {
      clearOAuthTimeout()
      isMounted = false
      subscription.unsubscribe()
    }
  }, [clearOAuthTimeout, getRoleForEmail, getApplicantLandingRouteForEmail])

  // AUTO-REDIRECT: Send logged-in users to their role-appropriate dashboard
  // WHEN: User has loaded auth state, is signed in, has a role, and is on home page
  // REDIRECTS: Admin → /admin, Provider → /provider, Applicant → /dashboard
  useEffect(() => {
    const redirectedFromProtectedRoute = Boolean(location.state?.from)
    const keepApplicantOnHome = redirectedFromProtectedRoute && role === 'Applicant'
    const landingRoute = role === 'Applicant' ? applicantLandingRoute : getLandingRoute(role)

    if (!isLoadingAuth && signedIn && role && location.pathname === '/' && !keepApplicantOnHome) {
      navigate(landingRoute, { replace: true })
    }
  }, [isLoadingAuth, signedIn, role, applicantLandingRoute, location.pathname, location.state, navigate])

  // Clear session and reset all state when logging out
  const handleLogout = async () => {
    clearOAuthTimeout()

    if (hasSupabaseConfig) {
      await supabase.auth.signOut() // Clear session cookie
    }
    setSignedIn(false)
    setRole(null)
    setPendingEmail('')
    setIsSavingRole(false)
    setApplicantLandingRoute('/dashboard')
    navigate('/')
  }

  // NEW USER ROLE SELECTION: First-time users must choose their role
  // WHY: roles (Admin/Provider/Applicant) determine which dashboard they access
  // PROCESS:
  // 1. User logs in with Google (new email, not in database yet)
  // 2. We show role selection popup
  // 3. User picks role → we insert into 'users' table with their email + role
  // 4. Next login, step 2-3 are skipped (role already in database)
  const handleRoleSelection = async (selectedRole) => {
    if (!pendingEmail) {
      return
    }

    setIsSavingRole(true)
    setAuthError('')

    const { data: insertedUser, error } = await supabase
      .from('users')
      .insert({ email: pendingEmail, role: selectedRole })
      .select('role')
      .single()

    if (error) {
      setIsSavingRole(false)
      setAuthError('Could not save role selection. Please try again.')
      return
    }

    const resolvedRole = insertedUser?.role || selectedRole
    setRole(resolvedRole)
    setPendingEmail('')
    setIsSavingRole(false)

    if (resolvedRole === 'Applicant') {
      setApplicantLandingRoute('/profile')
      navigate('/profile', { replace: true })
      return
    }

    setApplicantLandingRoute(getLandingRoute(resolvedRole))
    navigate(getLandingRoute(resolvedRole), { replace: true })
  }

  // Generate particle positions for 3D animation (748 dots in 34x22 grid)
  // Complex math creates radial gradient effect that reacts to mouse movement
  const dots = useMemo(() => {
    const result = []
    const columns = 34
    const rows = 22

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        const index = row * columns + col
        const nx = (col - (columns - 1) / 2) / ((columns - 1) / 2)
        const ny = (row - (rows - 1) / 2) / ((rows - 1) / 2)
        const r = Math.sqrt(nx * nx + ny * ny)
        const z = (1 - Math.min(r, 1)) * 110 - Math.abs(nx) * 32
        const dx = ((col % 5) - 2) * 1.6
        const dy = ((row % 5) - 2) * 1.4
        const dz = ((index % 7) - 3) * 2.2
        const delay = `${(index % 11) * 0.18}s`
        const duration = `${3.6 + (index % 6) * 0.6}s`
        result.push({ nx, ny, z, id: `${row}-${col}`, dx, dy, dz, delay, duration })
      }
    }

    return result
  }, [])

  // Track mouse position for 3D particle effect
  const handleVisualMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const px = ((event.clientX - rect.left) / rect.width - 0.5) * 2
    const py = ((event.clientY - rect.top) / rect.height - 0.5) * 2
    setPointer({ x: px, y: py })
  }

  const resetVisualMove = () => setPointer({ x: 0, y: 0 })

  // OAUTH ENTRY POINT: Initiate Google sign-in
  // HOW: Calls Supabase.auth.signInWithOAuth() which opens Google login popup
  // THEN: Auth listener (above) automatically detects successful login and looks up role
  // NOTE: Don't manually handle role lookup here—let the auth listener do it (keeps logic centralized)
  const handleGoogleContinue = async () => {
    setAuthError('')

    if (!hasSupabaseConfig) {
      setAuthError('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before using Google login.')
      return
    }

    setIsLoadingAuth(true)

    clearOAuthTimeout()
    oauthTimeoutRef.current = window.setTimeout(() => {
      setIsLoadingAuth(false)
      setAuthError('Google sign-in timed out. Please try again.')
    }, 12000)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: oauthRedirectTo,
      },
    })

    if (error) {
      clearOAuthTimeout()
      setIsLoadingAuth(false)
      setAuthError('Google sign-in failed. Verify Supabase redirect URLs include your local host and VITE_AUTH_REDIRECT_URL value.')
    }
  }

  // Fade in sections as they scroll into view
  useEffect(() => {
    if (location.pathname !== '/') {
      return undefined
    }

    const nodes = document.querySelectorAll('.scroll-animate')

    if (!nodes.length) {
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible') // Add CSS class to trigger fade-in
          } else {
            entry.target.classList.remove('is-visible') // Remove class when scrolled past
          }
        })
      },
      { threshold: 0.18 }, // Element must be 18% visible to trigger
    )

    nodes.forEach((node) => observer.observe(node))

    return () => {
      nodes.forEach((node) => observer.unobserve(node))
      observer.disconnect()
    }
  }, [location.pathname])

  // Track if user has scrolled past the hero section (used for topbar styling)
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 120)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // All routes: home page with auth, and protected role dashboards
return (
  <Routes>
    <Route path="/" element={
      <main className="foundry-clone">

        <header className={`global-topbar ${isScrolled ? 'is-scrolled' : ''}`}>
          <div className="topbar-main">
            <div className="topbar-brand">SA LEARNERSHIP FOUNDRY</div>
            <nav className="topbar-nav">
              <a href="#">Why Portal</a>
              <a href="#">Pathways</a>
              <a href="#">Team</a>
              <a href="#">Insights</a>
              <a href="#">Contact</a>
            </nav>
          </div>

          <div className="topbar-auth">
            {signedIn && role ? <span className="role-display">{role}</span> : null}
            <button className="google-auth" onClick={signedIn ? handleLogout : handleGoogleContinue}>
              {isLoadingAuth ? 'Authenticating...' : signedIn ? 'Logout' : 'Log In with Google'}
            </button>
          </div>
        </header>

        <section className="page-one">
          <div className="hero-main">
            <h1 className="left-title">
              BUILDING TALENT
              <br />
              PATHWAYS THAT
            </h1>

            <div
              className="interactive-model"
              onMouseMove={handleVisualMove}
              onMouseLeave={resetVisualMove}
              style={{ '--px': pointer.x, '--py': pointer.y }}
            >
              <div className="orbital-core">
                <span className="orbit orbit-a"></span>
                <span className="orbit orbit-b"></span>
                <span className="orbit orbit-c"></span>
              </div>

              <div className="dot-volume">
                {dots.map((dot) => (
                  <span
                    key={dot.id}
                    className="dot"
                    style={{
                      '--x': `${dot.nx * 340}px`,
                      '--y': `${dot.ny * 240}px`,
                      '--z': `${dot.z}px`,
                    }}
                  />
                ))}
              </div>
            </div>

            <h1 className="right-title">
              PUSH THE
              <br />
              FUTURE FORWARD
            </h1>
          </div>

          <div className="hero-bottom">
            <p>
              A venture lab style platform for learnership access, application intelligence,
              and practical support that moves candidates from skill to real work.
            </p>

            <div className="status-pill">
              {signedIn && role
                ? `${role} workspace unlocked`
                : signedIn && pendingEmail
                  ? 'Choose your role to continue'
                  : 'Sign in with Google to continue'}
            </div>
          </div>
          {signedIn && !role && pendingEmail ? (
            <div className="role-onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="role-onboarding-title">
              <div className="role-onboarding">
                <p className="role-onboarding-eyebrow">One more step</p>
                <h2 id="role-onboarding-title">Choose your role</h2>
                <p>Select how you want to use the platform for {pendingEmail}.</p>
                <div className="role-select">
                  <button onClick={() => handleRoleSelection('Applicant')} disabled={isSavingRole}>
                    Applicant
                  </button>
                  <button onClick={() => handleRoleSelection('Provider')} disabled={isSavingRole}>
                    Provider
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {authError ? <p className="auth-error">{authError}</p> : null}
        </section>

        <section className="page-two">
          <div className="ethos-row scroll-animate">
            <div>
              <p className="mini-label">Why this platform</p>
              <h2>
                OPEN DOORS
                <br />
                TO REAL WORK
              </h2>
            </div>

            <div className="ethos-copy">
              <p>
                Learnership Foundry helps applicants, providers, and moderators collaborate in one
                flow. Discover pathways, publish opportunities, and keep quality high with
                visibility from intake to placement.
              </p>
            </div>
          </div>

          <div className="card-strip scroll-animate swipe-left">
            <article className="signal-card tone-dark">
              <h3>Discover</h3>
              <p>APPLICANT VIEW</p>
              <span className="card-art" aria-hidden="true"></span>
              <small>Find learnerships that match your interests and readiness level.</small>
            </article>

            <article className="signal-card tone-cyan">
              <h3>Publish</h3>
              <p>PROVIDER VIEW</p>
              <span className="card-art" aria-hidden="true"></span>
              <small>Create listings and track engagement from qualified candidates.</small>
            </article>

            <article className="signal-card tone-orange">
              <h3>Moderate</h3>
              <p>ADMIN VIEW</p>
              <span className="card-art" aria-hidden="true"></span>
              <small>Flag risk, request fixes, and approve opportunities confidently.</small>
            </article>

            <article className="signal-card tone-light">
              <h3>Move</h3>
              <p>OUTCOMES</p>
              <span className="card-art" aria-hidden="true"></span>
              <small>Turn applications into skills, credentials, and workplace entry points.</small>
            </article>
          </div>
        </section>

        <section className="page-three">
          <span className="dot-plane" aria-hidden="true"></span>
          <div className="focus-copy scroll-animate">
            <p className="mini-label">Built for momentum</p>
            <h2>
              From FIRST CLICK
              <br />
              TO FIRST PAYCHECK
            </h2>
            <p>
              Scroll the platform, choose your role, and move into the right workspace to continue.
            </p>
          </div>
        </section>

      </main>
    } />

    
   <Route path="/dashboard" element={
  <ProtectedRoute role={role} allowedRole="Applicant" signedIn={signedIn} isLoading={isLoadingAuth}>
    <Dashboard onLogout={handleLogout} />
  </ProtectedRoute>
} />

<Route path="/dashboard/listings/:listingId" element={
  <ProtectedRoute role={role} allowedRole="Applicant" signedIn={signedIn} isLoading={isLoadingAuth}>
    <ApplicantListingDetail onLogout={handleLogout} />
  </ProtectedRoute>
} />

  <Route path="/profile" element={
    <ProtectedRoute role={role} allowedRole="Applicant" signedIn={signedIn} isLoading={isLoadingAuth}>
      <ApplicantProfile onLogout={handleLogout} />
    </ProtectedRoute>
  } />

<Route path="/provider" element={
  <ProtectedRoute role={role} allowedRole="Provider" signedIn={signedIn} isLoading={isLoadingAuth}>
    <Provider onLogout={handleLogout} />
  </ProtectedRoute>
} />

<Route path="/provider/listings/new" element={
  <ProtectedRoute role={role} allowedRole="Provider" signedIn={signedIn} isLoading={isLoadingAuth}>
    <ProviderListingForm />
  </ProtectedRoute>
} />

<Route path="/provider/listings/:listingId/edit" element={
  <ProtectedRoute role={role} allowedRole="Provider" signedIn={signedIn} isLoading={isLoadingAuth}>
    <ProviderListingEdit />
  </ProtectedRoute>
} />

<Route path="/provider/listings/:listingId/applications" element={
  <ProtectedRoute role={role} allowedRole="Provider" signedIn={signedIn} isLoading={isLoadingAuth}>
    <ProviderListingApplications />
  </ProtectedRoute>
} />

<Route path="/admin" element={
  <ProtectedRoute role={role} allowedRole="Admin" signedIn={signedIn} isLoading={isLoadingAuth}>
    <AdminDashboardShell onLogout={handleLogout} />
  </ProtectedRoute>
} />

  </Routes>
)
}

export default App
