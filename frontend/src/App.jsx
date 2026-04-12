/**
 * ============================================================================
 * App.jsx - Main Application Component
 * ============================================================================
 * Orchestrates authentication, role-based routing, and displays the landing page.
 * HARD PARTS:
 * 1. OAuth flow with role selection: Google login → email lookup → role choice
 * 2. Session persistence: Restores user session on page refresh
 * 3. Route guards: ProtectedRoute prevents unauthorized access
 * 4. Complex state machine: Tracks auth loading, sign-in status, role, and role selection
 * 5. 3D dot animation: Client-side math for interactive visual effect
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import ApplicantProfile from './pages/ApplicantProfile'
import Provider from './pages/Provider'
import { hasSupabaseConfig, supabase } from './lib/supabaseClient'

const moderationQueue = [
  { title: 'Junior Electrical Apprenticeship', provider: 'VoltPath Academy', risk: 'Needs final compliance check' },
  { title: 'Admin Intern - Retail Operations', provider: 'Sabela Retail Group', risk: 'Duplicate listing detected' },
  { title: 'Plumbing Learnership NQF 3', provider: 'Blue Pipe Training Hub', risk: 'Closing date mismatch' },
]

/**
 * ============================================================================
 * AdminDashboardShell Component
 * ============================================================================
 * Displays the admin moderation dashboard with pending reviews and KPIs.
 * Used when user has Admin role.
 */
function AdminDashboardShell({ onLogout }) {
  return (
    <div className="admin-page">
      <div className="admin-grid-overlay" aria-hidden="true"></div>

      <div className="admin-shell">
        <div className="admin-header-row">
          <div className="admin-title-block">
            <p className="mini-label">ADMIN PANEL</p>
            <h1>Platform Moderation Console</h1>
            <p>
              Review opportunity quality, verify provider submissions, and keep listings
              aligned with policy and NQF requirements.
            </p>
          </div>

          <div className="admin-status-card">
            <p>Signed in as</p>
            <strong>Admin</strong>
            <span>Google OAuth session active</span>
            <button onClick={onLogout} className="admin-btn">
                Logout
           </button>
          </div>
        </div>

        <div className="admin-kpi-row">
          <div className="admin-kpi">
            <span>Pending Reviews</span>
            <strong>18</strong>
          </div>
          <div className="admin-kpi">
            <span>Flagged Listings</span>
            <strong>6</strong>
          </div>
          <div className="admin-kpi">
            <span>Provider Appeals</span>
            <strong>3</strong>
          </div>
          <div className="admin-kpi">
            <span>Avg Turnaround</span>
            <strong>14h</strong>
          </div>
        </div>

        <div className="admin-content-row">
          <div className="admin-panel">
            <div className="admin-panel-head">
              <h2>Moderation Queue</h2>
              <button type="button">View all</button>
            </div>

            <div className="admin-list">
              {moderationQueue.map((item) => (
                <div key={item.title} className="admin-list-item">
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.provider}</p>
                  </div>
                  <span>{item.risk}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-panel admin-side-panel">
            <h2>Quick Actions</h2>
            <div className="admin-action-list">
              <button type="button">Approve selected listings</button>
              <button type="button">Send provider feedback</button>
              <button type="button">Export moderation report</button>
            </div>
            <div className="admin-note">
              Provider listings are moderated here once they are approved into production flow.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * ============================================================================
 * ProtectedRoute Component
 * ============================================================================
 * Route guard that enforces role-based access control.
 * HARD PART: Validates three conditions before rendering route:
 * 1. User is not loading auth (isLoading must be false)
 * 2. User is signed in (signedIn must be true)
 * 3. User has correct role (role === allowedRole)
 * If any check fails, redirects to home page.
 * Shows "Checking your session..." while auth state is unknown.
 */
function ProtectedRoute({ role, allowedRole, signedIn, isLoading, children }) {
  const location = useLocation()

  if (isLoading) {
    return (
      <main className="auth-loading-shell" aria-busy="true" aria-live="polite">
        <p>Checking your session...</p>
      </main>
    )
  }

  if (!signedIn) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  if (role !== allowedRole) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  return children
}

/**
 * ============================================================================
 * getLandingRoute Function
 * ============================================================================
 * Determines where to redirect user after successful OAuth based on role.
 * ROUTING LOGIC:
 * - Admin → /admin (moderation console)
 * - Provider → /provider (listings dashboard)
 * - Applicant → /dashboard (learnership search)
 * Used in two places:
 * 1. After role selection completes
 * 2. When user navigates to home with valid session
 */
function getLandingRoute(role) {
  if (role === 'Admin') return '/admin'
  if (role === 'Provider') return '/provider'
  return '/dashboard'
}

/**
 * ============================================================================
 * App Component - Main State and Auth Logic
 * ============================================================================
 * COMPONENT STATE (8 pieces of state to track auth journey):
 */
function App() {
  /**
   * AUTH STATE
   * - role: User's role (Applicant, Provider, Admin, or null)
   * - signedIn: Whether user has valid Google session
   * - isLoadingAuth: True while checking session or role
   * - authError: Error message to display to user
   * - pendingEmail: Email from Google OAuth but role not yet selected
   * - isSavingRole: True while inserting role into database
   */
  const [role, setRole] = useState(null)
  const [signedIn, setSignedIn] = useState(false)
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)
  const [authError, setAuthError] = useState('')
  const [pendingEmail, setPendingEmail] = useState('')
  const [isSavingRole, setIsSavingRole] = useState(false)

  /**
   * INTERACTIVE ANIMATION STATE
   * - pointer: Mouse position for 3D dot effect
   * - isScrolled: Whether user has scrolled past hero section
   */
  const [pointer, setPointer] = useState({ x: 0, y: 0 })
  const [isScrolled, setIsScrolled] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  /**
   * ========================================================================
   * SECTION: Database Role Lookup
   * ========================================================================
   * HARD PART: This function queries the users table to find existing roles.
   * Used during:
   * 1. Session restore (on page load)
   * 2. After Google OAuth (to check if email already has role)
   * 3. Auth state changes (when user signs in/out)
   */
  const getRoleForEmail = useCallback(async (email) => {
    // Query users table: find role by email address
    const { data: userRecord, error: fetchError } = await supabase
      .from('users')
      .select('role')
      .eq('email', email)
      .maybeSingle() // Returns null if no match (expected for new users)

    if (fetchError) {
      throw fetchError // Will be caught by useEffect
    }

    // Return role if found, null if email doesn't exist in users table
    return userRecord?.role ?? null
  }, [])

  /**
   * ========================================================================
   * SECTION: Auth Initialization and Session Restoration
   * ========================================================================
   * This effect runs ONCE on component mount to:
   * 1. Check if Supabase is configured (env vars present)
   * 2. Restore user session if browser has valid cookie
   * 3. Look up user's role from database
   * 4. Set up listener for auth state changes (sign-in, sign-out)
   * 
   * HARD PARTS:
   * - isMounted flag prevents state updates after unmount (memory leak prevention)
   * - Handles multiple async operations in sequence
   * - Sets up event listener that triggers whenever auth state changes
   * - Cleans up subscription when component unmounts
   */
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
          setIsLoadingAuth(false)
        }
        return
      }

      try {
        const resolvedRole = await getRoleForEmail(existingSession.user.email)
        if (isMounted) {
          setSignedIn(true)
          setRole(resolvedRole)
          setPendingEmail(resolvedRole ? '' : existingSession.user.email)
          setAuthError('')
        }
      } catch {
        if (isMounted) {
          setSignedIn(false)
          setRole(null)
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
        setSignedIn(false)
        setRole(null)
        setPendingEmail('')
        setIsSavingRole(false)
        setIsLoadingAuth(false)
        return
      }

      try {
        const resolvedRole = await getRoleForEmail(session.user.email)
        if (!isMounted) {
          return
        }
        setSignedIn(true)
        setRole(resolvedRole)
        setPendingEmail(resolvedRole ? '' : session.user.email)
        setAuthError('')
      } catch {
        if (!isMounted) {
          return
        }
        setSignedIn(false)
        setRole(null)
        setAuthError('OAuth succeeded, but role lookup failed. Please verify Supabase table policies.')
      } finally {
        if (isMounted) {
          setIsLoadingAuth(false)
        }
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [getRoleForEmail])

  /**
   * ========================================================================
   * SECTION: Auto-Redirect After Successful Login
   * ========================================================================
   * This effect monitors auth status and redirects user to role-specific page.
   * Triggers when: user signs in successfully, page loads, or pathname changes
   * 
   * LOGIC:
   * - If user is on home (/), signed in, AND has role → navigate to role page
   * - Skips if redirected FROM a protected route (to avoid redirect loop)
   * - Does nothing if already on correct role page
   */
  useEffect(() => {
    const redirectedFromProtectedRoute = Boolean(location.state?.from)

    if (!isLoadingAuth && signedIn && role && location.pathname === '/' && !redirectedFromProtectedRoute) {
      navigate(getLandingRoute(role), { replace: true })
    }
  }, [isLoadingAuth, signedIn, role, location.pathname, location.state, navigate])

  /**
   * ========================================================================
   * SECTION: Logout Handler
   * ========================================================================
   * Clears session from Supabase auth and resets all local state.
   * After logout, user is redirected to home page.
   */
  const handleLogout = async () => {
    if (hasSupabaseConfig) {
      await supabase.auth.signOut() // Clear session cookie
    }
    setSignedIn(false)
    setRole(null)
    setPendingEmail('')
    setIsSavingRole(false)
    navigate('/')
  }

  /**
   * ========================================================================
   * SECTION: Role Selection Handler
   * ========================================================================
   * HARD PART: Multi-step process when user selects Applicant or Provider
   * 1. User has pendingEmail but no role (from Google OAuth)
   * 2. User clicks Applicant or Provider button
   * 3. App inserts new row in users table (email + role)
   * 4. Sets local role state
   * 5. Clears pendingEmail to hide role selection dialog
   * 6. Navigates to role-specific page
   * 
   * Error handling: Shows auth error if database insert fails
   */
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
    navigate(getLandingRoute(resolvedRole), { replace: true })
  }

  /**
   * ========================================================================
   * SECTION: 3D Dot Animation Calculation
   * ========================================================================
   * HARD PART: Complex 3D math to create interactive particle effect.
   * Generates 748 dots (34 columns × 22 rows) with calculated positions.
   * 
   * MATH BREAKDOWN:
   * - nx, ny: Normalized coordinates (-1 to +1) based on grid position
   * - r: Distance from center (for radial gradient effect)
   * - z: Depth (z-index), increases toward edges
   * - dx, dy, dz: Random jitter added to position
   * - delay: Staggered animation start time
   * - duration: How long each dot animates
   * 
   * Used with CSS transforms and pointer position to create 3D effect.
   */
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

  /**
   * ========================================================================
   * SECTION: Interactive Visual Animation
   * ========================================================================
   * Tracks mouse position to move 3D dot cloud effect.
   * Used with CSS custom properties to apply transformations.
   */
  const handleVisualMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const px = ((event.clientX - rect.left) / rect.width - 0.5) * 2
    const py = ((event.clientY - rect.top) / rect.height - 0.5) * 2
    setPointer({ x: px, y: py })
  }

  const resetVisualMove = () => setPointer({ x: 0, y: 0 })

  /**
   * ========================================================================
   * SECTION: Google OAuth Handler
   * ========================================================================
   * Initiates Google Sign-In flow.
   * HARD PART: Redirect flow:
   * 1. User clicks "Log In with Google"
   * 2. Redirects to Google login page
   * 3. After auth, redirects back to origin (browser handles this)
   * 4. Supabase auth listener (from useEffect) catches redirect
   * 5. getRoleForEmail checks if email exists in users table
   * 6. If role exists → user auto-redirects to role page
   * 7. If no role → role selection dialog appears
   */
  const handleGoogleContinue = async () => {
    setAuthError('')

    if (!hasSupabaseConfig) {
      setAuthError('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before using Google login.')
      return
    }

    setIsLoadingAuth(true)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })

    if (error) {
      setIsLoadingAuth(false)
      setAuthError('Google sign-in failed. Check Supabase Google provider configuration.')
    }
  }

  /**
   * ========================================================================
   * SECTION: Scroll Animation Observer
   * ========================================================================
   * Watches elements with .scroll-animate class and fades them in when visible.
   * Uses Intersection Observer API for performance (doesn't check every scroll).
   * Only runs on home page (location.pathname === '/').
   */
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

  /**
   * ========================================================================
   * SECTION: Scroll Event Listener
   * ========================================================================
   * Tracks if user has scrolled past the hero section (120px).
   * Used to apply .is-scrolled class to topbar for visual feedback.
   */
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 120)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /**
   * ========================================================================
   * SECTION: Main Render / Routes
   * ========================================================================
   * Shows home page at /, protected role pages, and login options.
   */
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
              <div className="card-art" aria-hidden="true"></div>
              <small>Find learnerships that match your interests and readiness level.</small>
            </article>

            <article className="signal-card tone-cyan">
              <h3>Publish</h3>
              <p>PROVIDER VIEW</p>
              <div className="card-art" aria-hidden="true"></div>
              <small>Create listings and track engagement from qualified candidates.</small>
            </article>

            <article className="signal-card tone-orange">
              <h3>Moderate</h3>
              <p>ADMIN VIEW</p>
              <div className="card-art" aria-hidden="true"></div>
              <small>Flag risk, request fixes, and approve opportunities confidently.</small>
            </article>

            <article className="signal-card tone-light">
              <h3>Move</h3>
              <p>OUTCOMES</p>
              <div className="card-art" aria-hidden="true"></div>
              <small>Turn applications into skills, credentials, and workplace entry points.</small>
            </article>
          </div>
        </section>

        <section className="page-three">
          <div className="dot-plane" aria-hidden="true"></div>
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

<Route path="/admin" element={
  <ProtectedRoute role={role} allowedRole="Admin" signedIn={signedIn} isLoading={isLoadingAuth}>
    <AdminDashboardShell onLogout={handleLogout} />
  </ProtectedRoute>
} />

  </Routes>
)
}

export default App
