import { useEffect, useMemo, useState } from 'react'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'

function getPendingListings(listings) {
  return listings.filter((listing) => listing?.status === 'Pending')
}

function buildAdminActionPayload(adminId, actionType, targetId, reason) {
  const payload = {
    admin_id: adminId,
    action_type: actionType,
    target_type: 'listing',
    target_id: targetId,
  }

  if (reason) {
    payload.reason = reason
  }

  return payload
}

export default function Admin({
  onLogout = () => {},
  listings = [],
  onApproveListing,
  onRemoveListing,
  onLogAdminAction,
  currentAdminId = '',
  userRole = 'Admin',
  isAuthenticated = true,
}) {
  const pendingListings = useMemo(() => getPendingListings(listings), [listings])
  const [visibleListings, setVisibleListings] = useState(pendingListings)
  const [removeReason, setRemoveReason] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    setVisibleListings(pendingListings)
  }, [pendingListings])

  if (!isAuthenticated) {
    return (
      <main className="admin-page">
        <section className="admin-shell">
          <p>Redirecting to home</p>
        </section>
      </main>
    )
  }

  if (userRole !== 'Admin') {
    return (
      <main className="admin-page">
        <section className="admin-shell">
          <p>Access denied. Admins only.</p>
        </section>
      </main>
    )
  }

  const persistListingStatus = async (listingId, status) => {
    if (!hasSupabaseConfig) {
      return
    }

    await supabase.from('opportunities').update({ status }).eq('id', listingId)
  }

  const persistAdminAction = async (payload) => {
    if (!hasSupabaseConfig) {
      return
    }

    await supabase.from('admin_actions').insert(payload)
  }

  const removeFromVisibleQueue = (listingId) => {
    setVisibleListings((currentListings) => currentListings.filter((listing) => listing.id !== listingId))
  }

  const handleApprove = async (listing) => {
    const payload = buildAdminActionPayload(currentAdminId, 'approved', listing.id)

    if (typeof onApproveListing === 'function') {
      onApproveListing(listing.id)
    } else {
      await persistListingStatus(listing.id, 'Approved')
    }

    if (typeof onLogAdminAction === 'function') {
      onLogAdminAction(payload)
    } else {
      await persistAdminAction(payload)
    }

    removeFromVisibleQueue(listing.id)
    setErrorMessage('')
    setStatusMessage(`Approved ${listing.title}`)
  }

  const handleRemove = async (listing) => {
    if (!removeReason.trim()) {
      setErrorMessage('Remove reason is required before removing a listing.')
      return
    }

    const reason = removeReason.trim()
    const payload = buildAdminActionPayload(currentAdminId, 'removed', listing.id, reason)

    if (typeof onRemoveListing === 'function') {
      onRemoveListing(listing.id, reason)
    } else {
      await persistListingStatus(listing.id, 'Removed')
    }

    if (typeof onLogAdminAction === 'function') {
      onLogAdminAction(payload)
    } else {
      await persistAdminAction(payload)
    }

    removeFromVisibleQueue(listing.id)
    setRemoveReason('')
    setErrorMessage('')
    setStatusMessage(`Removed ${listing.title}`)
  }

  return (
    <main className="admin-page">
      <span className="admin-grid-overlay" aria-hidden="true"></span>

      <section className="admin-shell">
        <header className="admin-header-row">
          <section className="admin-title-block">
            <p className="mini-label">Admin Workspace</p>
            <h1>Platform Moderation Console</h1>
            <p>
              Review opportunity quality, verify provider submissions, and keep listings aligned
              with policy and NQF requirements.
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
            <strong>{visibleListings.length}</strong>
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

            <div className="admin-note">{statusMessage || errorMessage}</div>

            <label className="admin-removal-label" htmlFor="remove-reason">
              Remove reason
            </label>
            <textarea
              id="remove-reason"
              value={removeReason}
              onChange={(event) => {
                setRemoveReason(event.target.value)
                setErrorMessage('')
              }}
              rows="3"
              placeholder="Enter a moderation reason before removing a listing"
            />

            {visibleListings.length === 0 ? (
              <p className="admin-note">No pending listings to review.</p>
            ) : (
              <ul className="admin-list">
                {visibleListings.map((listing) => (
                  <li key={listing.id} className="admin-list-item">
                    <header>
                      <h3>{listing.title}</h3>
                      <p>{listing.provider}</p>
                    </header>
                    <span>{listing.type}</span>
                    <span>{listing.location}</span>
                    <span>{listing.closingDate}</span>
                    <div className="admin-action-list">
                      <button type="button" onClick={() => handleApprove(listing)}>
                        Approve
                      </button>
                      <button type="button" onClick={() => handleRemove(listing)}>
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside className="admin-panel admin-side-panel" aria-label="Quick actions">
            <h2>Quick Actions</h2>
            <nav className="admin-action-list" aria-label="Admin quick actions">
              <button type="button">Review selected listings</button>
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