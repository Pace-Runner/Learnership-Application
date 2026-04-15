import { useCallback, useEffect, useMemo, useState } from 'react'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'

function getPendingListings(listings) {
  return listings.filter((listing) => listing?.status === 'Pending')
}

function buildAdminActionPayload(adminId, actionType, targetId, reason) {
  const payload = {
    admin_id: adminId || null,
    action_type: actionType,
    target_type: 'listing',
    target_id: targetId,
  }

  if (reason) {
    payload.reason = reason
  }

  return payload
}

function normalizeListing(row) {
  const providerFromJoin = row?.provider_profiles?.organisation_name
  return {
    id: row.id,
    title: row.title || 'Untitled opportunity',
    provider: row.provider || providerFromJoin || row.provider_id || 'Unknown provider',
    type: row.type || 'Not specified',
    location: row.location || 'Not specified',
    closingDate: row.closingDate || row.closing_date || 'Not specified',
    status: row.status,
  }
}

export default function Admin({
  onLogout = () => {},
  listings,
  onApproveListing,
  onRemoveListing,
  onLogAdminAction,
  currentAdminId = '',
  userRole = 'Admin',
  isAuthenticated = true,
}) {
  const hasProvidedListings = Array.isArray(listings)
  const pendingListings = useMemo(
    () => getPendingListings(hasProvidedListings ? listings : []),
    [hasProvidedListings, listings],
  )
  const [visibleListings, setVisibleListings] = useState(pendingListings)
  const [removeReason, setRemoveReason] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isQueueLoading, setIsQueueLoading] = useState(false)
  const [resolvedAdminId, setResolvedAdminId] = useState('')

  useEffect(() => {
    if (hasProvidedListings) {
      setVisibleListings(pendingListings)
    }
  }, [hasProvidedListings, pendingListings])

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

  const effectiveAdminId = currentAdminId || resolvedAdminId || ''

  const resolveAdminId = useCallback(async () => {
    if (!hasSupabaseConfig || hasProvidedListings) {
      return
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user?.email) {
      return
    }

    const { data: userRecord } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .maybeSingle()

    if (userRecord?.id) {
      setResolvedAdminId(userRecord.id)
      return
    }

    const { data: upsertedAdmin } = await supabase
      .from('users')
      .upsert({ email: user.email, role: 'Admin' }, { onConflict: 'email' })
      .select('id')
      .maybeSingle()

    if (upsertedAdmin?.id) {
      setResolvedAdminId(upsertedAdmin.id)
    }
  }, [hasProvidedListings])

  const fetchPendingListings = useCallback(async () => {
    if (hasProvidedListings) {
      return
    }

    if (!hasSupabaseConfig) {
      setVisibleListings([])
      setErrorMessage('Supabase config missing. Cannot load moderation queue.')
      return
    }

    setIsQueueLoading(true)
    setErrorMessage('')

    const { data, error } = await supabase
      .from('opportunities')
      .select('id,title,type,location,closing_date,status,provider_id,provider_profiles:provider_id(organisation_name)')
      .eq('status', 'Pending')
      .order('created_at', { ascending: false })

    if (error) {
      setVisibleListings([])
      setErrorMessage('Could not load pending listings. Check Supabase RLS policies.')
      setIsQueueLoading(false)
      return
    }

    setVisibleListings((data || []).map(normalizeListing))
    setIsQueueLoading(false)
  }, [hasProvidedListings])

  useEffect(() => {
    resolveAdminId()
    fetchPendingListings()
  }, [resolveAdminId, fetchPendingListings])

  const persistListingStatus = async (listingId, status) => {
    if (!hasSupabaseConfig) {
      return
    }

    const { error } = await supabase.from('opportunities').update({ status }).eq('id', listingId)
    return error
  }

  const persistAdminAction = async (payload) => {
    if (!hasSupabaseConfig) {
      return
    }

    const { error } = await supabase.from('admin_actions').insert(payload)
    return error
  }

  const removeFromVisibleQueue = (listingId) => {
    setVisibleListings((currentListings) => currentListings.filter((listing) => listing.id !== listingId))
  }

  const handleApprove = async (listing) => {
    const payload = buildAdminActionPayload(effectiveAdminId, 'approved', listing.id)

    if (typeof onApproveListing === 'function') {
      onApproveListing(listing.id)
    } else {
      const updateError = await persistListingStatus(listing.id, 'Approved')
      if (updateError) {
        setErrorMessage('Could not approve listing. Check database permissions.')
        return
      }
    }

    if (typeof onLogAdminAction === 'function') {
      onLogAdminAction(payload)
    } else {
      const logError = await persistAdminAction(payload)
      if (logError) {
        setErrorMessage('Listing approved, but action log failed.')
      }
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
    const payload = buildAdminActionPayload(effectiveAdminId, 'removed', listing.id, reason)

    if (typeof onRemoveListing === 'function') {
      onRemoveListing(listing.id, reason)
    } else {
      const updateError = await persistListingStatus(listing.id, 'Removed')
      if (updateError) {
        setErrorMessage('Could not remove listing. Check database permissions.')
        return
      }
    }

    if (typeof onLogAdminAction === 'function') {
      onLogAdminAction(payload)
    } else {
      const logError = await persistAdminAction(payload)
      if (logError) {
        setErrorMessage('Listing removed, but action log failed.')
      }
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
              <button type="button" onClick={fetchPendingListings}>View all</button>
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

            {isQueueLoading ? (
              <p className="admin-note">Loading pending listings...</p>
            ) : visibleListings.length === 0 ? (
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