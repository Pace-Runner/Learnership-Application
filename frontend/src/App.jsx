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

function getLandingRoute(role) {
  if (role === 'Admin') return '/admin'
  if (role === 'Provider') return '/provider'
  return '/dashboard'
}

function App() {
  const [role, setRole] = useState(null)
  const [signedIn, setSignedIn] = useState(false)
  const [isLoadingAuth, setIsLoadingAuth] = useState(true)
  const [authError, setAuthError] = useState('')
  const [pendingEmail, setPendingEmail] = useState('')
  const [isSavingRole, setIsSavingRole] = useState(false)

  const [pointer, setPointer] = useState({ x: 0, y: 0 })
  const [isScrolled, setIsScrolled] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const getRoleForEmail = useCallback(async (email) => {
    const { data: userRecord, error: fetchError } = await supabase
      .from('users')
      .select('role')
      .eq('email', email)
      .maybeSingle()

    if (fetchError) {
      throw fetchError
    }

    return userRecord?.role ?? null
  }, [])

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

  useEffect(() => {
    const redirectedFromProtectedRoute = Boolean(location.state?.from)

    if (!isLoadingAuth && signedIn && role && location.pathname === '/' && !redirectedFromProtectedRoute) {
      navigate(getLandingRoute(role), { replace: true })
    }
  }, [isLoadingAuth, signedIn, role, location.pathname, location.state, navigate])

  const handleLogout = async () => {
    if (hasSupabaseConfig) {
      await supabase.auth.signOut()
    }
    setSignedIn(false)
    setRole(null)
    setPendingEmail('')
    setIsSavingRole(false)
    navigate('/')
  }

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

  const handleVisualMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const px = ((event.clientX - rect.left) / rect.width - 0.5) * 2
    const py = ((event.clientY - rect.top) / rect.height - 0.5) * 2
    setPointer({ x: px, y: py })
  }

  const resetVisualMove = () => setPointer({ x: 0, y: 0 })

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
            entry.target.classList.add('is-visible')
          } else {
            entry.target.classList.remove('is-visible')
          }
        })
      },
      { threshold: 0.18 },
    )

    nodes.forEach((node) => observer.observe(node))

    return () => {
      nodes.forEach((node) => observer.unobserve(node))
      observer.disconnect()
    }
  }, [location.pathname])

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 120)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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
