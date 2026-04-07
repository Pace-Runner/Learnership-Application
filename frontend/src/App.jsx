import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Provider from './pages/Provider'
import Admin from './pages/Admin'

const cards = [
  {
    title: 'Exponential Foresight',
    body: 'We identify early movement in sectors before they become obvious, then align candidates to high-upside opportunity flow.',
    tone: 'tone-dark',
  },
  {
    title: 'Full-Stack Support',
    body: 'From profile building to interview readiness and mentorship links, applicants get practical support from day one.',
    tone: 'tone-cyan',
  },
  {
    title: 'Financial Stability',
    body: 'Stipend-aware pathways and realistic planning help applicants sustain progress while upskilling into real work.',
    tone: 'tone-orange',
  },
  {
    title: 'Intelligent Iteration',
    body: 'Feedback loops improve every cycle so each application becomes stronger, clearer, and more targeted.',
    tone: 'tone-light',
  },
]

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
            <strong>Admin Preview</strong>
            <span>Temporary frontend-only shell</span>
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
              This shell is wired for visual preview while OAuth/admin role mapping is in
              progress.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProtectedRoute({ role, allowedRole, signedIn, children }) {
  const location = useLocation()

  if (!signedIn) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  if (role !== allowedRole) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  return children
}

function App() {
  const [role, setRole] = useState(() => {
  return localStorage.getItem('role') || 'Applicant'
})
  const [signedIn, setSignedIn] = useState(() => {
  return localStorage.getItem('signedIn') === 'true'
})



  const [pointer, setPointer] = useState({ x: 0, y: 0 })
  const [isScrolled, setIsScrolled] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
  localStorage.removeItem('signedIn')
  setSignedIn(false)
}, [])
useEffect(() => {
  if (location.pathname === '/') {
    setSignedIn(false)
    localStorage.removeItem('signedIn')
  }
}, [location.pathname])

const handleLogout = () => {
  setSignedIn(false)
  setRole('Applicant') // reset default
  localStorage.clear()
  navigate('/')
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

 const handleGoogleContinue = () => {
  setSignedIn(true)
localStorage.setItem('signedIn', 'true')

  if (role === 'Applicant') {
    navigate('/dashboard')
  } else if (role === 'Provider') {
    navigate('/provider')
  } else if (role === 'Admin') {
    navigate('/admin')
  }
}

  useEffect(() => {
    const nodes = document.querySelectorAll('.scroll-animate')

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
  }, [])

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
            <div className="role-select">
              {['Applicant', 'Provider', 'Admin'].map((item) => (
                <button
                  key={item}
                  className={item === role ? 'active' : ''}
                  onClick={() => {
                    setRole(item)
                     localStorage.setItem('role', item)
                  }}
                >
                  {item}
                </button>
              ))}
            </div>

            <button className="google-auth" onClick={handleGoogleContinue}>
              {signedIn ? 'Entering Workspace...' : 'Log In with Google'}
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
              {signedIn ? `${role} workspace unlocked` : `Role selected: ${role}`}
            </div>
          </div>
        </section>

      </main>
    } />

    
   <Route path="/dashboard" element={
  <ProtectedRoute role={role} allowedRole="Applicant" signedIn={signedIn}>
    <Dashboard onLogout={handleLogout} />
  </ProtectedRoute>
} />

<Route path="/provider" element={
  <ProtectedRoute role={role} allowedRole="Provider" signedIn={signedIn}>
    <Provider onLogout={handleLogout} />
  </ProtectedRoute>
} />

<Route path="/admin" element={
  <ProtectedRoute role={role} allowedRole="Admin" signedIn={signedIn}>
    <AdminDashboardShell onLogout={handleLogout} />
  </ProtectedRoute>
} />

  </Routes>
)
}

export default App
