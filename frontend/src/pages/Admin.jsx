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
  const [selectedListingId, setSelectedListingId] = useState('')
  const [reviewAction, setReviewAction] = useState('')
  const [actionReason, setActionReason] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isQueueLoading, setIsQueueLoading] = useState(false)
  const [resolvedAdminId, setResolvedAdminId] = useState('')
  const [approvedCount, setApprovedCount] = useState(0)
  const [removedCount, setRemovedCount] = useState(0)
  const [approvedHistory, setApprovedHistory] = useState([])
  const [removedHistory, setRemovedHistory] = useState([])
  const [historyView, setHistoryView] = useState('approved')
  const [isSubmittingAction, setIsSubmittingAction] = useState(false)

  useEffect(() => {
    if (hasProvidedListings) {
      setVisibleListings(pendingListings)
    }
  }, [hasProvidedListings, pendingListings])

  useEffect(() => {
    if (!visibleListings.some((listing) => listing.id === selectedListingId)) {
      setSelectedListingId('')
      setReviewAction('')
      setActionReason('')
    }
  }, [visibleListings, selectedListingId])

  const effectiveAdminId = currentAdminId || resolvedAdminId || ''
  const selectedListing = visibleListings.find((listing) => listing.id === selectedListingId) || null
  const historyItems = historyView === 'approved' ? approvedHistory : removedHistory

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
      .order('created_at', { ascending: true })

    if (error) {
      setVisibleListings([])
      setErrorMessage('Could not load pending listings. Check Supabase RLS policies.')
      setIsQueueLoading(false)
      return
    }

    setVisibleListings((data || []).map(normalizeListing))
    setIsQueueLoading(false)
  }, [hasProvidedListings])

  const fetchAdminInsights = useCallback(async () => {
    if (hasProvidedListings || !hasSupabaseConfig || !effectiveAdminId) {
      return
    }

    const { data: actions, error } = await supabase
      .from('admin_actions')
      .select('target_id,action_type,created_at,reason')
      .eq('admin_id', effectiveAdminId)
      .eq('target_type', 'listing')
      .in('action_type', ['approved', 'removed'])
      .order('created_at', { ascending: false })

    if (error) {
      return
    }

    const approvedActions = (actions || []).filter((action) => action.action_type === 'approved')
    const removedActions = (actions || []).filter((action) => action.action_type === 'removed')

    const targetIds = [...new Set((actions || []).map((action) => action.target_id).filter(Boolean))]
    let titleMap = {}

    if (targetIds.length) {
      const { data: opportunities } = await supabase
        .from('opportunities')
        .select('id,title')
        .in('id', targetIds)

      titleMap = Object.fromEntries((opportunities || []).map((item) => [item.id, item.title]))
    }

    setApprovedCount(approvedActions.length)
    setRemovedCount(removedActions.length)
    setApprovedHistory(
      approvedActions.map((action) => ({
        id: action.target_id,
        title: titleMap[action.target_id] || `Listing ${action.target_id}`,
        createdAt: action.created_at,
      })),
    )
    setRemovedHistory(
      removedActions.map((action) => ({
        id: action.target_id,
        title: titleMap[action.target_id] || `Listing ${action.target_id}`,
        createdAt: action.created_at,
        reason: action.reason,
      })),
    )
  }, [effectiveAdminId, hasProvidedListings])

  useEffect(() => {
    resolveAdminId()
    fetchPendingListings()
  }, [resolveAdminId, fetchPendingListings])

  useEffect(() => {
    fetchAdminInsights()
  }, [fetchAdminInsights])

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

  const approveSingleListing = async (listing) => {
    const reason = actionReason.trim()
    const payload = buildAdminActionPayload(effectiveAdminId, 'approved', listing.id, reason)

    if (typeof onApproveListing === 'function') {
      onApproveListing(listing.id)
    } else {
      const updateError = await persistListingStatus(listing.id, 'Approved')
      if (updateError) {
        setErrorMessage('Could not approve listing. Check database permissions.')
        return false
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
    return true
  }

  const removeSingleListing = async (listing, reason) => {
    const payload = buildAdminActionPayload(effectiveAdminId, 'removed', listing.id, reason)

    if (typeof onRemoveListing === 'function') {
      onRemoveListing(listing.id, reason)
    } else {
      const updateError = await persistListingStatus(listing.id, 'Removed')
      if (updateError) {
        setErrorMessage('Could not remove listing. Check database permissions.')
        return false
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
    return true
  }

  const handleApprove = async (listing) => {
    const didApprove = await approveSingleListing(listing)
    if (!didApprove) {
      return
    }
    setSelectedListingId('')
    setReviewAction('')
    setActionReason('')
    setErrorMessage('')
    setStatusMessage(`Approved ${listing.title}`)
    await fetchAdminInsights()
  }

  const handleRemove = async (listing) => {
    if (!actionReason.trim()) {
      setErrorMessage('Remove reason is required before removing a listing.')
      return
    }

    const reason = actionReason.trim()
    const didRemove = await removeSingleListing(listing, reason)
    if (!didRemove) {
      return
    }

    setSelectedListingId('')
    setReviewAction('')
    setActionReason('')
    setErrorMessage('')
    setStatusMessage(`Removed ${listing.title}`)
    await fetchAdminInsights()
  }

  const handleConfirmAction = async () => {
    if (!selectedListing) {
      setErrorMessage('Choose a listing first.')
      return
    }

    if (!reviewAction) {
      setErrorMessage('Choose approve or remove first.')
      return
    }

    if (!actionReason.trim()) {
      setErrorMessage('Please provide a reason before confirming.')
      return
    }

    setIsSubmittingAction(true)
    if (reviewAction === 'approved') {
      await handleApprove(selectedListing)
    } else {
      await handleRemove(selectedListing)
    }
    setIsSubmittingAction(false)
  }

  const handleCancelAction = () => {
    setReviewAction('')
    setActionReason('')
    setErrorMessage('')
  }

  const handleExportModerationReport = () => {
    if (historyItems.length === 0) {
      setErrorMessage('No items available in this view to export.')
      return
    }

    const header = ['listing_id', 'title', 'action', 'performed_at']
    const rows = historyItems.map((item) => [item.id, item.title, historyView, item.createdAt || ''])

    const csv = [header, ...rows]
      .map((row) => row.map((value) => `"${String(value || '').replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${historyView}-listings-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setErrorMessage('')
    setStatusMessage(`${historyView === 'approved' ? 'Approved' : 'Removed'} listings report exported.`)
  }

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
            <span>Approved Opportunities</span>
            <strong>{approvedCount}</strong>
          </article>
          <article className="admin-kpi">
            <span>Removed Opportunities</span>
            <strong>{removedCount}</strong>
          </article>
        </section>

        <section className="admin-content-row">
          <section className="admin-panel" aria-label="Moderation queue">
            <header className="admin-panel-head">
              <h2>Moderation Queue</h2>
              <button type="button" onClick={fetchPendingListings}>View all</button>
            </header>

            <div className="admin-note">{statusMessage || errorMessage}</div>

            {isQueueLoading ? (
              <p className="admin-note">Loading pending listings...</p>
            ) : visibleListings.length === 0 ? (
              <p className="admin-note">No pending listings to review.</p>
            ) : (
              <ul className="admin-list admin-list-scroll">
                {visibleListings.map((listing) => (
                  <li key={listing.id} className="admin-list-item">
                    <button
                      type="button"
                      className={`admin-queue-card ${selectedListingId === listing.id ? 'is-active' : ''}`}
                      onClick={() => {
                        setSelectedListingId(listing.id)
                        setReviewAction('')
                        setActionReason('')
                        setErrorMessage('')
                        setStatusMessage('')
                      }}
                    >
                      <h3>{listing.title}</h3>
                      <p>{listing.provider}</p>
                      <div className="admin-queue-meta">
                        <span>{listing.type}</span>
                        <span>{listing.location}</span>
                        <span>{listing.closingDate}</span>
                      </div>
                    </button>

                    {selectedListingId === listing.id ? (
                      <section className="admin-selection-panel" aria-label="Selected listing review panel">
                        <h3>Selected Listing</h3>
                        <p>{listing.title}</p>
                        <div className="admin-review-actions">
                          <button
                            type="button"
                            className={reviewAction === 'approved' ? 'is-active' : ''}
                            onClick={() => {
                              setReviewAction('approved')
                              setErrorMessage('')
                            }}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className={reviewAction === 'removed' ? 'is-active' : ''}
                            onClick={() => {
                              setReviewAction('removed')
                              setErrorMessage('')
                            }}
                          >
                            Remove
                          </button>
                        </div>

                        {reviewAction ? (
                          <div className="admin-confirm-panel">
                            <label className="admin-removal-label" htmlFor={`action-reason-${listing.id}`}>
                              {reviewAction === 'approved' ? 'Approval reason' : 'Removal reason'}
                            </label>
                            <textarea
                              id={`action-reason-${listing.id}`}
                              value={actionReason}
                              onChange={(event) => {
                                setActionReason(event.target.value)
                                setErrorMessage('')
                              }}
                              rows="3"
                              placeholder={`Explain why this listing should be ${reviewAction === 'approved' ? 'approved' : 'removed'}.`}
                            />
                            <div className="admin-confirm-actions">
                              <button type="button" onClick={handleConfirmAction} disabled={isSubmittingAction}>
                                {isSubmittingAction ? 'Saving...' : `Confirm ${reviewAction === 'approved' ? 'Approve' : 'Remove'}`}
                              </button>
                              <button type="button" className="admin-ghost-btn" onClick={handleCancelAction}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </section>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside className="admin-panel admin-side-panel" aria-label="Quick actions">
            <h2>Quick Actions</h2>
            <nav className="admin-action-list" aria-label="Admin quick actions">
              <button
                type="button"
                className={historyView === 'approved' ? 'is-active' : ''}
                onClick={() => setHistoryView('approved')}
              >
                Approved listings
              </button>
              <button
                type="button"
                className={historyView === 'removed' ? 'is-active' : ''}
                onClick={() => setHistoryView('removed')}
              >
                Removed listings
              </button>
              <button type="button" onClick={handleExportModerationReport}>Export moderation report</button>
            </nav>
            <section className="admin-history-panel" aria-label="Admin action history">
              <h3>{historyView === 'approved' ? 'Approved opportunities' : 'Removed opportunities'}</h3>
              {historyItems.length === 0 ? (
                <p className="admin-note">No listings in this history yet.</p>
              ) : (
                <ul className="admin-history-list">
                  {historyItems.map((item) => (
                    <li key={`${item.id}-${item.createdAt}`}>
                      <strong>{item.title}</strong>
                      <span>{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Unknown date'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <p className="admin-note">
              Provider listings are moderated here once they are approved into production flow.
            </p>
          </aside>
        </section>
      </section>
    </main>
  )
}