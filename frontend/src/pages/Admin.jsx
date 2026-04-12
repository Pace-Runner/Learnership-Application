/**
 * ============================================================================
 * Admin.jsx - Admin Dashboard
 * ============================================================================
 * Simple admin workspace page showing placeholder moderation console.
 * THIS IS A SIMPLIFIED VERSION - full moderation UI is in App.jsx AdminDashboardShell
 * 
 * Future enhancements:
 * - Move full moderation queue from App.jsx here
 * - Add real data from database instead of sample data
 * - Implement approval/rejection actions
 */

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