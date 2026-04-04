import { useEffect, useMemo, useState } from 'react'
import './App.css'

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

function App() {
  const [role, setRole] = useState('Applicant')
  const [signedIn, setSignedIn] = useState(false)
  const [pointer, setPointer] = useState({ x: 0, y: 0 })
  const [isScrolled, setIsScrolled] = useState(false)

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
            {['Applicant', 'Provider'].map((item) => (
              <button
                type="button"
                key={item}
                className={item === role ? 'active' : ''}
                onClick={() => setRole(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <button type="button" className="google-auth" onClick={handleGoogleContinue}>
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
            aria-hidden="true"
          >
            <div className="orbital-core">
              <span className="orbit orbit-a"></span>
              <span className="orbit orbit-b"></span>
              <span className="orbit orbit-c"></span>
              <span className="orbit-runner runner-a">
                <span className="orbit-dot"></span>
              </span>
              <span className="orbit-runner runner-b">
                <span className="orbit-dot"></span>
              </span>
              <span className="orbit-runner runner-c">
                <span className="orbit-dot"></span>
              </span>
              <span className="orbit-runner runner-d">
                <span className="orbit-dot"></span>
              </span>
            </div>

            <div className="dot-volume">
              {dots.map((dot) => {
                const x = dot.nx * 340
                const y = dot.ny * 240
                const z = dot.z + (Math.abs(dot.nx) + Math.abs(dot.ny)) * 18

                return (
                  <span
                    key={dot.id}
                    className="dot"
                    style={{
                      '--x': `${x}px`,
                      '--y': `${y}px`,
                      '--z': `${z}px`,
                      '--dx': `${dot.dx}px`,
                      '--dy': `${dot.dy}px`,
                      '--dz': `${dot.dz}px`,
                      '--delay': dot.delay,
                      '--dur': dot.duration,
                    }}
                  ></span>
                )
              })}
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

      <section className="page-two scroll-animate swipe-left">
        <div className="ethos-row scroll-animate">
          <div>
            <p className="mini-label">OUR ETHOS</p>
            <h2>
              VISION DRIVES
              <br />
              VELOCITY.
            </h2>
          </div>

          <div className="ethos-copy">
            <p>
              Our comprehensive applicant platform shifts the odds with infrastructure
              that actually works. Career support, practical guidance, and pathway
              discovery happen in one connected system.
            </p>
          </div>
        </div>

        <div className="card-strip scroll-animate">
          {cards.map((card, index) => (
            <article key={card.title} className={`signal-card ${card.tone} scroll-animate`}>
              <h3>{card.title}</h3>
              <div className="card-art" aria-hidden="true"></div>
              <p>{`${String(index + 1).padStart(2, '0')} / 04`}</p>
              <small>{card.body}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="page-three scroll-animate">
        <div className="dot-plane" aria-hidden="true"></div>
        <div className="focus-copy scroll-animate">
          <p className="mini-label">OUR FOCUS</p>
          <h2>
            FROM POTENTIAL
            <br />
            TO PAYCHECK.
          </h2>
          <p>
            Discover learnerships faster, apply smarter, and turn your skills into real
            work experience with one connected journey.
          </p>
        </div>
      </section>
    </main>
  )
}

export default App
