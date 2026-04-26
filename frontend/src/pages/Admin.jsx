import { useCallback, useEffect, useMemo, useState } from 'react'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'

function getPendingListings(listings) 
{
  return listings.filter((listing) => listing?.status === 'Pending')
}



function buildAdminActionPayload(adminId, actionType, targetId, reason) 
{
  // Keep the audit payload shape aligned with the admin_actions table.
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






function normalizeListing(row) 
{
  // API rows can come from joins or mocked props, so normalize once for the UI.
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

const adminTabs = [
  { id: 'approve-remove', label: 'Approve/Remove Listings' },
  { id: 'delete', label: 'Delete' },
]

const queueTypeFilters = [
  { id: 'all', label: 'All' },
  { id: 'internship', label: 'Internship' },
  { id: 'learnership', label: 'Learnership' },
  { id: 'apprenticeship', label: 'Apprenticeship' },
]

const deleteEntityTabs = [
  { id: 'applicant', label: 'Applicant' },
  { id: 'provider', label: 'Provider' },
  { id: 'listing', label: 'Listing' },
]

const deleteSearchHints = {
  applicant: {
    placeholder: 'Search applicants by Gmail or first/last name',
    examples: ['thabo', 'naidoo', 'gmail.com'],
  },
  provider: {
    placeholder: 'Search providers by Gmail or organisation name',
    examples: ['academy', 'group', 'gmail.com'],
  },
  listing: {
    placeholder: 'Search listings by title or listing ID',
    examples: ['electric', 'learnership', 'a1b2'],
  },
}

const emptyDeleteStats = {
  admin: {
    users: 0,
    providers: 0,
    listings: 0,
  },
  all: {
    users: 0,
    providers: 0,
    listings: 0,
  },
}

const emptyDeleteDirectory = {
  applicant: [],
  provider: [],
  listing: [],
}

function buildDeleteStats(actions, currentAdminId) {
  const stats = {
    admin: { ...emptyDeleteStats.admin },
    all: { ...emptyDeleteStats.all },
  }

  for (const action of actions || []) {
    const isCurrentAdminAction = currentAdminId && action.admin_id === currentAdminId

    if (action.target_type === 'listing') {
      stats.all.listings += 1
      if (isCurrentAdminAction) {
        stats.admin.listings += 1
      }
      continue
    }

    if (action.target_type === 'applicant' || action.target_type === 'provider') {
      const bucket = action.target_type === 'provider' ? 'providers' : 'users'
      stats.all[bucket] += 1
      if (isCurrentAdminAction) {
        stats.admin[bucket] += 1
      }
    }
  }

  return stats
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
}) 






{
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
  const [activeAdminTab, setActiveAdminTab] = useState('approve-remove')
  const [queueTypeFilter, setQueueTypeFilter] = useState('all')
  const [deleteStats, setDeleteStats] = useState(emptyDeleteStats)
  const [deleteEntityTab, setDeleteEntityTab] = useState('applicant')
  const [deleteSearchQuery, setDeleteSearchQuery] = useState('')
  const [deleteDirectory, setDeleteDirectory] = useState(emptyDeleteDirectory)
  const [isSubmittingAction, setIsSubmittingAction] = useState(false)

  useEffect(() => 
  {
    // In test/mocked mode, trust the supplied listings and keep local view in sync.
    if (hasProvidedListings) {
      setVisibleListings(pendingListings)
    }
  }, [hasProvidedListings, pendingListings])

  const effectiveAdminId = currentAdminId || resolvedAdminId || ''
  const filteredQueueListings = useMemo(() => {
    if (queueTypeFilter === 'all') {
      return visibleListings
    }

    return visibleListings.filter((listing) => (listing.type || '').toLowerCase() === queueTypeFilter)
  }, [queueTypeFilter, visibleListings])


  useEffect(() => 
    {
    if (!filteredQueueListings.some((listing) => listing.id === selectedListingId)) {
      setSelectedListingId('')
      setReviewAction('')
      setActionReason('')
    }
  }, [filteredQueueListings, selectedListingId])

  const selectedListing = filteredQueueListings.find((listing) => listing.id === selectedListingId) || null
  const historyItems = historyView === 'approved' ? approvedHistory : removedHistory
  const activeDeleteSearchHints = deleteSearchHints[deleteEntityTab]
  const filteredDeleteRecords = useMemo(() => {
    const query = deleteSearchQuery.trim().toLowerCase()
    const source = deleteDirectory[deleteEntityTab] || []

    if (!query) {
      return source
    }

    return source.filter((item) => item.searchIndex.includes(query))
  }, [deleteDirectory, deleteEntityTab, deleteSearchQuery])



  const resolveAdminId = useCallback(async () => {
    // Only resolve from auth when we are running against Supabase directly.
    if (!hasSupabaseConfig || hasProvidedListings) {
      return
    }



    const 
    {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user?.email) 
    {
      return
    }

    const { data: userRecord } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .maybeSingle()

    if (userRecord?.id) 
    {
      setResolvedAdminId(userRecord.id)
      return
    }


    const { data: upsertedAdmin } = await supabase
      .from('users')
      .upsert({ email: user.email, role: 'Admin' }, { onConflict: 'email' })
      .select('id')
      .maybeSingle()

    if (upsertedAdmin?.id) 
    {
      setResolvedAdminId(upsertedAdmin.id)
    }
  }, [hasProvidedListings])


  
  const fetchPendingListings = useCallback(async () => {
    if (hasProvidedListings) {
      return
    }

    if (!hasSupabaseConfig) 
    {
      setVisibleListings([])
      setErrorMessage('Supabase config missing. Cannot load moderation queue.')
      return
    }

    setIsQueueLoading(true)
    setErrorMessage('')

    // The moderation queue is intentionally restricted to Pending listings because Approved/Removed items move to history.
    const { data, error } = await supabase
      .from('opportunities')
      .select('id,title,type,location,closing_date,status,provider_id,provider_profiles:provider_id(organisation_name)')
      .eq('status', 'Pending')
      .order('created_at', { ascending: true })

    if (error) 
    {
      setVisibleListings([])
      setErrorMessage('Could not load pending listings. Check Supabase RLS policies.')
      setIsQueueLoading(false)
      return
    }

    setVisibleListings((data || []).map(normalizeListing))
    setIsQueueLoading(false)
  }, [hasProvidedListings])

  const fetchAdminInsights = useCallback(async () => {
    if (hasProvidedListings || !hasSupabaseConfig || !effectiveAdminId) 
    {
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

    if (targetIds.length) 
    {
      // Backfill human-friendly titles for history cards.
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

  const fetchDeleteInsights = useCallback(async () => {
    if (hasProvidedListings || !hasSupabaseConfig) {
      return
    }

    const { data: deletedActions, error: deletedActionsError } = await supabase
      .from('admin_actions')
      .select('admin_id,target_type,target_id,created_at')
      .eq('action_type', 'deleted')
      .in('target_type', ['listing', 'applicant', 'provider'])

    if (deletedActionsError) {
      return
    }

    const userTargetIds = [
      ...new Set(
        (deletedActions || [])
          .filter((action) => action.target_type === 'applicant' || action.target_type === 'provider')
          .map((action) => action.target_id)
          .filter(Boolean),
      ),
    ]

    let emailByUserId = {}

    if (userTargetIds.length) {
      const { data: targetUsers } = await supabase
        .from('users')
        .select('id,role,email')
        .in('id', userTargetIds)

      emailByUserId = Object.fromEntries((targetUsers || []).map((user) => [user.id, user.email || '']))
    }

    const deletedListingIdSet = new Set(
      (deletedActions || [])
        .filter((action) => action.target_type === 'listing' && action.target_id)
        .map((action) => action.target_id),
    )

    const [allUsersResult, allApplicantProfilesResult, allProviderProfilesResult, allListingsResult] =
      await Promise.all([
        supabase.from('users').select('id,email,role'),
        supabase.from('applicant_profiles').select('user_id,first_name,last_name'),
        supabase.from('provider_profiles').select('user_id,organisation_name,contact_email'),
        supabase.from('opportunities').select('id,title,status'),
      ])

    const applicantProfileByUserId = Object.fromEntries(
      (allApplicantProfilesResult.data || []).map((profile) => [profile.user_id, profile]),
    )
    const providerProfileByUserId = Object.fromEntries(
      (allProviderProfilesResult.data || []).map((profile) => [profile.user_id, profile]),
    )
    const nextDeleteDirectory = {
      applicant: [],
      provider: [],
      listing: [],
    }

    for (const user of allUsersResult.data || []) {
      if (!user?.id) {
        continue
      }

      const role = (user.role || '').toLowerCase()
      if (role !== 'applicant' && role !== 'provider') {
        continue
      }

      if (user.id === effectiveAdminId) {
        continue
      }

      const fallbackIdLabel = String(user.id).slice(0, 8)
      const email = user.email || emailByUserId[user.id] || ''

      if (role === 'provider') {
        const profile = providerProfileByUserId[user.id]
        const organisationName = profile?.organisation_name || `Provider ${fallbackIdLabel}`
        const providerEmail = profile?.contact_email || email
        nextDeleteDirectory.provider.push({
          id: user.id,
          primaryLabel: organisationName,
          secondaryLabel: `${providerEmail || 'Email unavailable'} • ID: ${user.id}`,
          createdAt: '',
          searchIndex: `${organisationName} ${providerEmail} ${user.id}`.toLowerCase(),
        })
      } else if (role === 'applicant') {
        const profile = applicantProfileByUserId[user.id]
        const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
        nextDeleteDirectory.applicant.push({
          id: user.id,
          primaryLabel: fullName || `Applicant ${fallbackIdLabel}`,
          secondaryLabel: `${email || 'Email unavailable'} • ID: ${user.id}`,
          createdAt: '',
          searchIndex: `${fullName} ${profile?.first_name || ''} ${profile?.last_name || ''} ${email} ${user.id}`.toLowerCase(),
        })
      }
    }

    for (const listing of allListingsResult.data || []) {
      if (!listing?.id || deletedListingIdSet.has(listing.id) || listing.status !== 'Approved') {
        continue
      }

      const title = listing.title || `Listing ${listing.id}`
      nextDeleteDirectory.listing.push({
        id: listing.id,
        primaryLabel: title,
        secondaryLabel: `ID: ${listing.id}`,
        createdAt: '',
        searchIndex: `${title} ${listing.id}`.toLowerCase(),
      })
    }

    nextDeleteDirectory.applicant.sort((a, b) => a.primaryLabel.localeCompare(b.primaryLabel))
    nextDeleteDirectory.provider.sort((a, b) => a.primaryLabel.localeCompare(b.primaryLabel))
    nextDeleteDirectory.listing.sort((a, b) => a.primaryLabel.localeCompare(b.primaryLabel))

    setDeleteStats(
      buildDeleteStats(deletedActions || [], effectiveAdminId),
    )
    setDeleteDirectory(nextDeleteDirectory)
  }, [effectiveAdminId, hasProvidedListings])

  useEffect(() => {
    resolveAdminId()
    fetchPendingListings()
  }, [resolveAdminId, fetchPendingListings])

  useEffect(() => {
    fetchAdminInsights()
    fetchDeleteInsights()
  }, [fetchAdminInsights, fetchDeleteInsights])

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

    // Every moderation decision is logged so approved and removed actions can be audited later.
    const { error } = await supabase.from('admin_actions').insert(payload)
    return error
  }

  const removeFromVisibleQueue = (listingId) => {
    setVisibleListings((currentListings) => currentListings.filter((listing) => listing.id !== listingId))
  }

  const approveSingleListing = async (listing) => {
    const reason = actionReason.trim()
    const payload = buildAdminActionPayload(effectiveAdminId, 'approved', listing.id, reason)

    // Support injected handlers in tests while still allowing direct DB writes in app mode.
    if (typeof onApproveListing === 'function') 
    {
      onApproveListing(listing.id)
    } 
    else 
    {
      const updateError = await persistListingStatus(listing.id, 'Approved')
      if (updateError) {
        setErrorMessage('Could not approve listing. Check database permissions.')
        return false
      }
    }

    if (typeof onLogAdminAction === 'function') 
    {
      onLogAdminAction(payload)
    } 
    else 
    {
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

    if (typeof onRemoveListing === 'function') 
    {
      onRemoveListing(listing.id, reason)
    } 
    else 
    {
      const updateError = await persistListingStatus(listing.id, 'Removed')
      if (updateError) 
      {
        setErrorMessage('Could not remove listing. Check database permissions.')
        return false
      }
    }

    if (typeof onLogAdminAction === 'function') 
    {
      onLogAdminAction(payload)
    } 
    else 
    {
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
    await fetchDeleteInsights()
  }

  const handleConfirmAction = async () => 
    {
    if (!selectedListing) 
    {
      setErrorMessage('Choose a listing first.')
      return
    }

    if (!reviewAction) 
    {
      setErrorMessage('Choose approve or remove first.')
      return
    }

    if (!actionReason.trim()) 
    {
      setErrorMessage('Please provide a reason before confirming.')
      return
    }

    // Approval/removal goes through one confirmation path so both status changes and admin action logging stay in sync.
    setIsSubmittingAction(true)
    if (reviewAction === 'approved') 
    {
      await handleApprove(selectedListing)
    } 
    else 
    {
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
    if (historyItems.length === 0) 
    {
      setErrorMessage('No items available in this view to export.')
      return
    }

    const header = ['listing_id', 'title', 'action', 'performed_at']
    const rows = historyItems.map((item) => [item.id, item.title, historyView, item.createdAt || ''])

    // Escape CSV values so commas/quotes in listing names do not break downloads.
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

  const renderApproveRemoveTab = () => (
    <>
      <section className="admin-kpi-row" aria-label="Moderation metrics">
        <article className="admin-kpi">
          <span>All Pending Review</span>
          <strong>{visibleListings.length}</strong>
        </article>
        <article className="admin-kpi">
          <span>This Admin Approved Opportunities</span>
          <strong>{approvedCount}</strong>
        </article>
        <article className="admin-kpi">
          <span>This Admin Removed Opportunities</span>
          <strong>{removedCount}</strong>
        </article>
      </section>

      <section className="admin-content-row">
        <section className="admin-panel" aria-label="Moderation queue">
          <header className="admin-panel-head">
            <h2>Moderation Queue</h2>
            <button type="button" onClick={fetchPendingListings}>View all</button>
          </header>

        <div className="admin-filter-row" role="tablist" aria-label="Listing type filter">
          {queueTypeFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              role="tab"
              aria-selected={queueTypeFilter === filter.id}
              className={queueTypeFilter === filter.id ? 'is-active' : ''}
              onClick={() => setQueueTypeFilter(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="admin-note">{statusMessage || errorMessage}</div>

        {isQueueLoading ? (
          <p className="admin-note">Loading pending listings...</p>
        ) : filteredQueueListings.length === 0 ? (
          <p className="admin-note">
            {queueTypeFilter === 'all'
              ? 'No pending listings to review.'
              : 'No pending listings match the selected type.'}
          </p>
        ) : (
          <ul className="admin-list admin-list-scroll">
            {filteredQueueListings.map((listing) => (
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
    </>
  )

  const renderDeleteTab = () => (
    <section className="admin-delete-section" aria-label="Delete insights">
      <section className="admin-panel">
        <h2>Delete</h2>

        <section className="admin-delete-group" aria-label="This admin delete metrics">
          <h3>This Admin Deleted</h3>
          <section className="admin-kpi-row">
            <article className="admin-kpi">
              <span>Applicants Deleted</span>
              <strong>{deleteStats.admin.users}</strong>
            </article>
            <article className="admin-kpi">
              <span>Providers Deleted</span>
              <strong>{deleteStats.admin.providers}</strong>
            </article>
            <article className="admin-kpi">
              <span>Listings Deleted</span>
              <strong>{deleteStats.admin.listings}</strong>
            </article>
          </section>
        </section>

        <section className="admin-delete-group" aria-label="All admin delete metrics">
          <h3>All Admins Deleted</h3>
          <section className="admin-kpi-row">
            <article className="admin-kpi">
              <span>Applicants Deleted</span>
              <strong>{deleteStats.all.users}</strong>
            </article>
            <article className="admin-kpi">
              <span>Providers Deleted</span>
              <strong>{deleteStats.all.providers}</strong>
            </article>
            <article className="admin-kpi">
              <span>Listings Deleted</span>
              <strong>{deleteStats.all.listings}</strong>
            </article>
          </section>
        </section>

        <section className="admin-delete-group" aria-label="Delete search tools">
          <h3>Search Available Entries</h3>

          <div className="admin-filter-row" role="tablist" aria-label="Delete entity filter">
            {deleteEntityTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={deleteEntityTab === tab.id}
                className={deleteEntityTab === tab.id ? 'is-active' : ''}
                onClick={() => {
                  setDeleteEntityTab(tab.id)
                  setDeleteSearchQuery('')
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <input
            type="search"
            className="admin-delete-search-input"
            value={deleteSearchQuery}
            onChange={(event) => setDeleteSearchQuery(event.target.value)}
            placeholder={activeDeleteSearchHints.placeholder}
            aria-label={`Search ${deleteEntityTab} records`}
          />

          <p className="admin-note">
            Try searching: {activeDeleteSearchHints.examples.join(', ')}
          </p>

          {filteredDeleteRecords.length === 0 ? (
            <p className="admin-note">No {deleteEntityTab} records match your search.</p>
          ) : (
            <ul className="admin-history-list admin-delete-results-list">
              {filteredDeleteRecords.map((record) => (
                <li key={`${record.id}-${record.createdAt}`}>
                  <strong>{record.primaryLabel}</strong>
                  <span>{record.secondaryLabel}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="admin-note">
          Provider deletions are counted from deleted account actions where the target account role is Provider.
        </p>
      </section>
    </section>
  )

  if (!isAuthenticated) 
  {
    return (
      <main className="admin-page">
        <section className="admin-shell">
          <p>Redirecting to home</p>
        </section>
      </main>
    )
  }

  if (userRole !== 'Admin') 
  {
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

        <section className="admin-toolbar" aria-label="Admin sections">
          <nav className="admin-tab-list" role="tablist" aria-label="Admin tabs">
            {adminTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeAdminTab === tab.id}
                className={activeAdminTab === tab.id ? 'is-active' : ''}
                onClick={() => setActiveAdminTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <button
            type="button"
            className="admin-download-btn"
            onClick={handleExportModerationReport}
            aria-label="Download moderation CSV"
          >
            Download CSV
          </button>
        </section>

        {activeAdminTab === 'approve-remove' ? (
          renderApproveRemoveTab()
        ) : (
          renderDeleteTab()
        )}
      </section>
    </main>
  )
}
