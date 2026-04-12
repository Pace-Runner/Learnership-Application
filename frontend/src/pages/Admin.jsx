// Admin workspace - moderation dashboard for reviewing listings

/**
 * ========================================================================
 * Admin Component (Admin Workspace)
 * ========================================================================
 * Renders admin moderation dashboard.
 * Props:
 * - onLogout: Callback function for logout button
 */
export default function Admin({ onLogout }) {
  return (
    <main className="user-page admin-theme" style={{ color: "white", padding: "40px" }}>
      <section className="user-hero">
        <div>
          <p className="user-kicker">Admin Workspace</p>
          <h1>Platform Moderation Console</h1>
          <p className="user-intro">
            Admin-only dashboard for reviewing and moderating learnership listings.
          </p>
        </div>
        <button onClick={onLogout} className="user-logout-btn">Logout</button>
      </section>
    </main>
  )
}