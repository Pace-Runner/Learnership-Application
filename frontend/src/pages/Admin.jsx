// Admin workspace - moderation dashboard for reviewing listings

/**
 * ========================================================================
 * Admin Component (Admin Workspace)
 * ========================================================================
 * Renders admin moderation dashboard.
 * Props:
 * - onLogout: Callback function for logout button
 */
const moderationQueue = [
  { title: 'Junior Electrical Apprenticeship', provider: 'VoltPath Academy', risk: 'Needs final compliance check' },
  { title: 'Admin Intern - Retail Operations', provider: 'Sabela Retail Group', risk: 'Duplicate listing detected' },
  { title: 'Plumbing Learnership NQF 3', provider: 'Blue Pipe Training Hub', risk: 'Closing date mismatch' },
]

>>>>>>> 9b8c203c6e71737da9b8b47b831564ccf5976ad7
export default function Admin({ onLogout }) {
  return (
    <main className="admin-page">
      <span className="admin-grid-overlay" aria-hidden="true"></span>

      <section className="admin-shell">
        <header className="admin-header-row">
          <section className="admin-title-block">
            <p className="mini-label">Admin Workspace</p>
            <h1>Platform Moderation Console</h1>
            <p>
              Review opportunity quality, verify provider submissions, and keep listings
              aligned with policy and NQF requirements.
            </p>
          </section>

          <aside className="admin-status-card" aria-label="Session status">
            <p>Signed in as</p>
            <strong>Admin</strong>
            <span>Google OAuth session active</span>
            <button onClick={onLogout} className="admin-btn">
              Logout
            </button>
          </aside>
        </header>

        <section className="admin-kpi-row" aria-label="Moderation metrics">
          <article className="admin-kpi">
            <span>Pending Reviews</span>
            <strong>18</strong>
          </article>
          <article className="admin-kpi">
            <span>Flagged Listings</span>
            <strong>6</strong>
          </article>
          <article className="admin-kpi">
            <span>Provider Appeals</span>
            <strong>3</strong>
          </article>
          <article className="admin-kpi">
            <span>Avg Turnaround</span>
            <strong>14h</strong>
          </article>
        </section>

        <section className="admin-content-row">
          <section className="admin-panel" aria-label="Moderation queue">
            <header className="admin-panel-head">
              <h2>Moderation Queue</h2>
              <button type="button">View all</button>
            </header>

            <ul className="admin-list">
              {moderationQueue.map((item) => (
                <li key={item.title} className="admin-list-item">
                  <header>
                    <h3>{item.title}</h3>
                    <p>{item.provider}</p>
                  </header>
                  <span>{item.risk}</span>
                </li>
              ))}
            </ul>
          </section>

          <aside className="admin-panel admin-side-panel" aria-label="Quick actions">
            <h2>Quick Actions</h2>
            <nav className="admin-action-list" aria-label="Admin quick actions">
              <button type="button">Approve selected listings</button>
              <button type="button">Send provider feedback</button>
              <button type="button">Export moderation report</button>
            </nav>
            <p className="admin-note">
              Provider listings are moderated here once they are approved into production flow.
            </p>
          </aside>
        </section>
      </section>
    </main>
  )
}