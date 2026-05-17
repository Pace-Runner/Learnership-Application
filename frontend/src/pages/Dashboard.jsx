// APPLICANT DASHBOARD: Main workspace for applicant users
// PURPOSE: Display available learnership listings and quick stats
// NOTE: Currently shows static/placeholder data; ready for Supabase integration

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'
import './UserPages.css'

export function formatRandAmount(value) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return 'Not specified'
  }

  return `R${parsed.toLocaleString('en-ZA', { maximumFractionDigits: 2 })}`
}

export function formatShortDate(value) {
  if (!value) {
    return 'Not specified'
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// Quick statistics shown at top of dashboard
const quickStats = [
  { label: 'Available listings', value: '18' },
  { label: 'Favourited opportunities', value: '12' },
  { label: 'Documents uploaded', value: '04' },
]

const availableListings = [
  {
    type: 'Learnership',
    title: 'Business Administration NQF 4',
    meta: 'Full-time office-based learnership with structured workplace exposure and weekly coaching.',
  },
  {
    type: 'Internship',
    title: 'Junior IT Support Internship',
    meta: 'Hands-on support role for a candidate who wants practical IT experience and a clear path into helpdesk work.',
  },
  {
    type: 'Apprenticeship',
    title: 'Electrical Trade Apprenticeship',
    meta: 'Structured trade programme with mentorship, safety training, and a trade-tested outcome.',
  },
]

const listingFilters = ['All', 'Learnership', 'Internship', 'Apprenticeship']
const applicationStatusLabels = {
  Received: 'Pending',
  Pending: 'Pending',
  Shortlisted: 'Reviewed',
  Offered: 'Accepted',
  Rejected: 'Rejected',
}

export function getApplicationStatusLabel(status) {
  return applicationStatusLabels[status] || 'Pending'
}

export function getApplicationStatusClass(status) {
  if (status === 'Pending' || status === 'Received') {
    return 'status-chip status-chip-pending'
  }

  if (status === 'Reviewed' || status === 'Shortlisted') {
    return 'status-chip status-chip-reviewed'
  }

  if (status === 'Accepted' || status === 'Offered') {
    return 'status-chip status-chip-approved'
  }

  if (status === 'Rejected') {
    return 'status-chip status-chip-removed'
  }

  return 'status-chip status-chip-pending'
}

export function formatApplicationDate(value) {
  if (!value) {
    return 'Not specified'
  }

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return parsedDate.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatNotificationDate(value) {
  if (!value) {
    return 'Not specified'
  }

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return parsedDate.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function getNotificationTypeLabel(type) {
  if (type === 'status_update') {
    return 'Application update'
  }

  if (type === 'new_opportunity') {
    return 'New opportunity'
  }

  if (type === 'closing_date') {
    return 'Closing reminder'
  }

  return 'Notification'
}

export function normalizeApplicationRow(row) {
  const opportunity = row.opportunities || row.opportunity || {}
  const applicantProfile = row.applicant_profiles || row.applicants || row.applicant || {}

  return {
    id: row.id,
    listingTitle: opportunity.title || 'Untitled opportunity',
    type: opportunity.type || 'Not specified',
    location: opportunity.location || 'Not specified',
    closingDate: opportunity.closing_date || '',
    appliedAt: row.applied_at || row.updated_at || '',
    status: getApplicationStatusLabel(row.status),
    applicantName: applicantProfile.first_name ? `${applicantProfile.first_name} ${applicantProfile.last_name || ''}`.trim() : 'Unknown',
  }
}

export function normalizeApprovedListing(row) {
  const providerProfile = row.provider_profiles || {}

  return {
    id: row.id,
    title: row.title || 'Untitled opportunity',
    type: row.type || 'Not specified',
    description: row.description || '',
    meta: row.meta,
    location: row.location || 'Not specified',
    stipend: row.stipend,
    closingDate: row.closingDate || row.closing_date || 'Not specified',
    status: row.status || 'Approved',
    provider: providerProfile.organisation_name || row.provider_name || row.provider || 'Not specified',
  }
}

function normalizeFavouriteRow(row) {
  const opportunity = row.opportunities || row.opportunity || {}

  return {
    favouriteId: row.id,
    favouriteCreatedAt: row.created_at,
    ...normalizeApprovedListing(opportunity),
  }
}

export function filterApprovedListings(listings, searchTerm, selectedType) {
  const normalizedSearchTerm = searchTerm.trim().toLowerCase()

  return listings.filter((listing) => {
    // Ensure listing has required fields to avoid incomplete records
    if (!listing?.id || !listing?.title) {
      return false
    }

    // Applicants should never see pending or removed opportunities in the search results.
    if (listing?.status && listing.status !== 'Approved') {
      return false
    }

    const title = String(listing?.title || '').toLowerCase()
    const description = String(listing?.description || '').toLowerCase()
    const listingLocation = String(listing?.location || '').toLowerCase()
    const listingType = String(listing?.type || '')

    const matchesSearch = !normalizedSearchTerm
      || title.includes(normalizedSearchTerm)
      || description.includes(normalizedSearchTerm)
      || listingLocation.includes(normalizedSearchTerm)

    const matchesType = selectedType === 'All' || listingType === selectedType

    return matchesSearch && matchesType
  })
}

// Applicant workspace component
export default function Dashboard({ onLogout, listings }) {
  const hasListingsProp = Array.isArray(listings)
  const [dbApprovedListings, setDbApprovedListings] = useState([])
  const [dbApplications, setDbApplications] = useState([])
  const [applicantId, setApplicantId] = useState('')
  const [applicantUserId, setApplicantUserId] = useState('')
  const [dbNotifications, setDbNotifications] = useState([])
  const [dbFavouriteListings, setDbFavouriteListings] = useState([])
  const [showReadNotifications, setShowReadNotifications] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState('All')
  const [submittedSearchTerm, setSubmittedSearchTerm] = useState('')
  const [submittedType, setSubmittedType] = useState('All')
  const [activeApplicantTab, setActiveApplicantTab] = useState('listings')
  const [searchError, setSearchError] = useState('')
  const [isLoadingListings, setIsLoadingListings] = useState(false)
  const [isLoadingApplications, setIsLoadingApplications] = useState(false)
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false)
  const [isLoadingFavourites, setIsLoadingFavourites] = useState(false)
  const [applicationError, setApplicationError] = useState('')
  const [notificationError, setNotificationError] = useState('')
  const [favouriteError, setFavouriteError] = useState('')
  const [updatingFavouriteId, setUpdatingFavouriteId] = useState('')
  const [isApplyingSearch, setIsApplyingSearch] = useState(false)
  const searchFeedbackTimeoutRef = useRef(null)
  const mountedRef = useRef(false)

  const loadApplicantFavourites = useCallback(async (targetApplicantId) => {
    if (hasListingsProp || !hasSupabaseConfig || !mountedRef.current || !targetApplicantId) {
      return
    }

    setIsLoadingFavourites(true)
    setFavouriteError('')

    const { data: favouriteRows, error: favouriteRowsError } = await supabase
      .from('favourites')
      .select('id,opportunity_id,created_at,opportunities:opportunity_id(id,title,type,description,location,closing_date,stipend,status)')
      .eq('applicant_id', targetApplicantId)
      .order('created_at', { ascending: false })

    if (!mountedRef.current) {
      return
    }

    if (favouriteRowsError) {
      setDbFavouriteListings([])
      setFavouriteError('We could not load your favourited opportunities right now.')
      setIsLoadingFavourites(false)
      return
    }

    setDbFavouriteListings(
      (favouriteRows || [])
        .map(normalizeFavouriteRow)
        .filter((listing) => listing.status === 'Approved'),
    )
    setIsLoadingFavourites(false)
  }, [hasListingsProp])

  const loadApplicantNotifications = useCallback(async (targetUserId) => {
    if (hasListingsProp || !hasSupabaseConfig || !mountedRef.current || !targetUserId) {
      return
    }

    setIsLoadingNotifications(true)
    setNotificationError('')

    const { data: notificationRows, error: notificationRowsError } = await supabase
      .from('notifications')
      .select('id,type,message,read,created_at')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })

    if (!mountedRef.current) {
      return
    }

    if (notificationRowsError) {
      setDbNotifications([])
      setNotificationError('We could not load your notifications right now.')
      setIsLoadingNotifications(false)
      return
    }

    setDbNotifications(notificationRows || [])
    setIsLoadingNotifications(false)
  }, [hasListingsProp])

  const markNotificationAsRead = useCallback(async (notificationId) => {
    if (!notificationId) {
      return
    }

    const { error: markAsReadError } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)

    if (markAsReadError) {
      return
    }

    setDbNotifications((current) =>
      current.map((notification) => (
        notification.id === notificationId
          ? { ...notification, read: true }
          : notification
      )),
    )
  }, [])

  const loadApplicantApplications = useCallback(async () => {
    if (hasListingsProp || !hasSupabaseConfig || !mountedRef.current) {
      return
    }

    setIsLoadingApplications(true)
    setApplicationError('')

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    const email = sessionData?.session?.user?.email

    if (!mountedRef.current) {
      return
    }

    if (sessionError || !email) {
      setDbApplications([])
      setApplicationError('We could not identify your applicant account.')
      setIsLoadingApplications(false)
      return
    }

    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (!mountedRef.current) {
      return
    }

    if (userError || !userRow?.id) {
      setDbApplications([])
      setApplicationError('Your applicant account was not found.')
      setIsLoadingApplications(false)
      return
    }

    setApplicantUserId(userRow.id)

    const { data: profileRow, error: profileError } = await supabase
      .from('applicant_profiles')
      .select('id,user_id')
      .eq('user_id', userRow.id)
      .maybeSingle()

    if (!mountedRef.current) {
      return
    }

    if (profileError || !profileRow?.id) {
      setDbApplications([])
      setApplicationError('Your applicant profile is not ready yet.')
      setIsLoadingApplications(false)
      return
    }

    setApplicantId(profileRow.id)

    const { data: applicationRows, error: applicationRowsError } = await supabase
      .from('applications')
      .select('id,status,applied_at,updated_at,opportunities:opportunity_id(id,title,type,location,closing_date)')
      .eq('applicant_id', profileRow.id)
      .order('updated_at', { ascending: false })

    if (!mountedRef.current) {
      return
    }

    if (applicationRowsError) {
      setDbApplications([])
      setApplicationError('We could not load your applications right now.')
      setIsLoadingApplications(false)
      return
    }

    setDbApplications((applicationRows || []).map(normalizeApplicationRow))
    setIsLoadingApplications(false)
  }, [hasListingsProp])

  useEffect(() => {
    mountedRef.current = true

    if (hasListingsProp || !hasSupabaseConfig) {
      return () => {
        mountedRef.current = false
      }
    }

    let isMounted = true

    const fetchApprovedListings = async () => {
      setIsLoadingListings(true)
      setSearchError('')

      // Pull the approved opportunities once, then let the dashboard handle the search/filtering client-side.
      const { data, error } = await supabase
        .from('opportunities')
        .select('id,title,type,description,location,closing_date,stipend,status')
        .eq('status', 'Approved')
        .order('created_at', { ascending: false })

      if (!isMounted) {
        return
      }

      if (error) {
        setSearchError('We could not load listings right now. Please try again.')
        setDbApprovedListings([])
        setIsLoadingListings(false)
        return
      }

      setDbApprovedListings((data || []).map(normalizeApprovedListing))
      setIsLoadingListings(false)
    }

    fetchApprovedListings()

    return () => {
      isMounted = false
    }
  }, [hasListingsProp])

  useEffect(() => {
    if (hasListingsProp || !hasSupabaseConfig) {
      return undefined
    }

    loadApplicantApplications()

    return () => {
      mountedRef.current = false
    }
  }, [hasListingsProp, loadApplicantApplications])

  useEffect(() => {
    if (hasListingsProp || !hasSupabaseConfig || !applicantId) {
      return undefined
    }

    loadApplicantFavourites(applicantId)

    const applicationsChannel = supabase
      .channel(`applicant-applications-${applicantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'applications',
          filter: `applicant_id=eq.${applicantId}`,
        },
        () => {
          loadApplicantApplications()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(applicationsChannel)
    }
  }, [applicantId, hasListingsProp, loadApplicantApplications, loadApplicantFavourites])

  useEffect(() => {
    if (hasListingsProp || !hasSupabaseConfig || !applicantUserId) {
      return undefined
    }

    loadApplicantNotifications(applicantUserId)

    const notificationsChannel = supabase
      .channel(`applicant-notifications-${applicantUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${applicantUserId}`,
        },
        () => {
          loadApplicantNotifications(applicantUserId)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(notificationsChannel)
    }
  }, [applicantUserId, hasListingsProp, loadApplicantNotifications])

  useEffect(() => {
    return () => {
      if (searchFeedbackTimeoutRef.current) {
        window.clearTimeout(searchFeedbackTimeoutRef.current)
      }
    }
  }, [])

  const approvedListings = useMemo(() => {
    if (hasListingsProp) {
      return filterApprovedListings(listings, submittedSearchTerm, submittedType)
    }

    if (!hasSupabaseConfig) {
      return filterApprovedListings(availableListings, submittedSearchTerm, submittedType)
    }

    return filterApprovedListings(dbApprovedListings, submittedSearchTerm, submittedType)
  }, [dbApprovedListings, hasListingsProp, listings, submittedSearchTerm, submittedType])

  const favouriteOpportunityIds = useMemo(
    () => new Set(dbFavouriteListings.map((listing) => listing.id)),
    [dbFavouriteListings],
  )

  const dashboardStats = useMemo(() => (
    quickStats.map((item) => (
      !hasListingsProp && item.label === 'Favourited opportunities'
        ? { ...item, value: String(dbFavouriteListings.length).padStart(2, '0') }
        : item
    ))
  ), [dbFavouriteListings.length, hasListingsProp])

  const handleSearchSubmit = (event) => {
    event.preventDefault()
    // Store the submitted search separately so typing in the form does not instantly change the visible results.
    setIsApplyingSearch(true)
    setSubmittedSearchTerm(searchTerm)
    setSubmittedType(selectedType)

    if (searchFeedbackTimeoutRef.current) {
      window.clearTimeout(searchFeedbackTimeoutRef.current)
    }

    searchFeedbackTimeoutRef.current = window.setTimeout(() => {
      setIsApplyingSearch(false)
      searchFeedbackTimeoutRef.current = null
    }, 450)
  }

  const handleFavouriteToggle = async (listing) => {
    if (!listing?.id) {
      return
    }

    if (hasListingsProp || !hasSupabaseConfig || !applicantId) {
      setFavouriteError('Please sign in with an applicant profile before favouriting listings.')
      return
    }

    const isFavourite = favouriteOpportunityIds.has(listing.id)
    setUpdatingFavouriteId(listing.id)
    setFavouriteError('')

    if (isFavourite) {
      const { error: deleteFavouriteError } = await supabase
        .from('favourites')
        .delete()
        .eq('applicant_id', applicantId)
        .eq('opportunity_id', listing.id)

      setUpdatingFavouriteId('')

      if (deleteFavouriteError) {
        setFavouriteError('We could not remove that favourited opportunity. Please try again.')
        return
      }

      setDbFavouriteListings((current) => current.filter((item) => item.id !== listing.id))
      return
    }

    const { error: insertFavouriteError } = await supabase
      .from('favourites')
      .insert({ applicant_id: applicantId, opportunity_id: listing.id })

    setUpdatingFavouriteId('')

    if (insertFavouriteError) {
      const isDuplicateFavourite = insertFavouriteError.code === '23505'
        || String(insertFavouriteError.message || '').toLowerCase().includes('duplicate')

      if (!isDuplicateFavourite) {
        console.error('Favourite save failed:', insertFavouriteError)
        setFavouriteError('We could not favourite that opportunity. Please try again.')
        return
      }
    }

    setDbFavouriteListings((current) => [
      {
        ...listing,
        favouriteId: `${applicantId}-${listing.id}`,
        favouriteCreatedAt: new Date().toISOString(),
      },
      ...current.filter((item) => item.id !== listing.id),
    ])
  }

  const hasActiveSearch = Boolean(submittedSearchTerm.trim() || submittedType !== 'All')
  const hasApplications = dbApplications.length > 0
  const hasFavouriteListings = dbFavouriteListings.length > 0
  const unreadNotifications = dbNotifications.filter((notification) => !notification.read)
  const readNotifications = dbNotifications.filter((notification) => notification.read)
  const visibleNotifications = showReadNotifications ? dbNotifications : unreadNotifications
  const hasVisibleNotifications = visibleNotifications.length > 0

  return (
    <main className="user-page applicant-theme user-discovery-shell">
      <section className="user-page-inner">
      <header className="user-hero">
        <section>
          <p className="user-kicker">Applicant Workspace</p>
          <h1>Find the right listings faster</h1>
          <p className="user-intro">
            Search and filter active listings, then jump into your profile page to manage
            your CV, certificates, bio, and profile photo.
          </p>
        </section>

        <nav className="user-nav-actions" aria-label="Applicant actions">
          <Link to="/profile" className="user-link-btn">Go to My Profile</Link>
          <button onClick={onLogout} className="user-logout-btn">Logout</button>
        </nav>
      </header>

      <section className="user-stat-grid" aria-label="Applicant quick stats">
        {dashboardStats.map((item) => (
          <article key={item.label} className="user-stat-card">
            <p>{item.label}</p>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="user-content-grid">
        {!hasListingsProp ? (
          <article className="user-panel user-panel-alt notification-panel">
            <div className="provider-panel-head">
              <section>
                <p className="provider-panel-kicker">Applicant inbox</p>
                <h2>Notifications</h2>
              </section>
              <span className="status-chip status-chip-soft">
                {unreadNotifications.length > 0 ? `${unreadNotifications.length} unread` : 'No unread alerts'}
              </span>
            </div>

            {isLoadingNotifications ? (
              <p className="user-panel-copy">Loading your notifications...</p>
            ) : notificationError ? (
              <p className="user-panel-copy">{notificationError}</p>
            ) : hasVisibleNotifications ? (
              <ul className="user-list notification-list notification-scroll-list">
                {visibleNotifications.map((notification) => (
                  <li key={notification.id} className="notification-list-item">
                    <div className="application-list-row">
                      <strong>{getNotificationTypeLabel(notification.type)}</strong>
                      {notification.read ? (
                        <span className="status-chip status-chip-soft">Read</span>
                      ) : (
                        <button
                          type="button"
                          className="notification-read-btn"
                          onClick={() => markNotificationAsRead(notification.id)}
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                    <p className="notification-copy">{notification.message}</p>
                    <small className="user-item-meta">{formatNotificationDate(notification.created_at)}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="user-panel-copy">
                {showReadNotifications
                  ? 'You do not have any notifications yet.'
                  : 'You do not have any unread notifications right now.'}
              </p>
            )}

            {readNotifications.length > 0 ? (
              <button
                type="button"
                className="notification-toggle-btn"
                onClick={() => setShowReadNotifications((current) => !current)}
              >
                {showReadNotifications ? 'Hide read notifications' : 'Show read notifications'}
              </button>
            ) : null}
          </article>
        ) : null}

        <article className="user-panel applicant-tab-shell">
          <div className="applicant-tab-list" role="tablist" aria-label="Applicant dashboard sections">
            <button
              type="button"
              role="tab"
              id="applicant-tab-listings"
              aria-selected={activeApplicantTab === 'listings'}
              aria-controls="applicant-panel-listings"
              className={`applicant-tab-btn${activeApplicantTab === 'listings' ? ' applicant-tab-btn-active' : ''}`}
              onClick={() => setActiveApplicantTab('listings')}
            >
              Current Listings and Internships
            </button>
            <button
              type="button"
              role="tab"
              id="applicant-tab-applications"
              aria-selected={activeApplicantTab === 'applications'}
              aria-controls="applicant-panel-applications"
              className={`applicant-tab-btn${activeApplicantTab === 'applications' ? ' applicant-tab-btn-active' : ''}`}
              onClick={() => setActiveApplicantTab('applications')}
            >
              My Applications
            </button>
            <button
              type="button"
              role="tab"
              id="applicant-tab-favourites"
              aria-selected={activeApplicantTab === 'favourites'}
              aria-controls="applicant-panel-favourites"
              className={`applicant-tab-btn${activeApplicantTab === 'favourites' ? ' applicant-tab-btn-active' : ''}`}
              onClick={() => setActiveApplicantTab('favourites')}
            >
              Favourites
            </button>
          </div>

          <section
            id="applicant-panel-listings"
            role="tabpanel"
            aria-labelledby="applicant-tab-listings"
            hidden={activeApplicantTab !== 'listings'}
            className="applicant-tab-panel"
          >
            <h2>Current Listings and Internships</h2>
            <section className="listing-search-panel listing-search-panel-embedded" aria-label="Listing search">
              <form className="listing-search-form" onSubmit={handleSearchSubmit}>
                <label htmlFor="listing-search" className="sr-only">Search listings</label>
                <input
                  id="listing-search"
                  type="search"
                  placeholder="Search by title, location, or sector"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
                <label htmlFor="listing-filter" className="sr-only">Filter listing type</label>
                <select
                  id="listing-filter"
                  value={selectedType}
                  onChange={(event) => setSelectedType(event.target.value)}
                >
                  {listingFilters.map((filter) => (
                    <option key={filter} value={filter}>{filter}</option>
                  ))}
                </select>
                <button type="submit" className="user-action-btn search-btn">Search</button>
              </form>
            </section>

            {searchError ? <p className="user-panel-copy">{searchError}</p> : null}
            {/* Keep the panel explicit about whether it is loading, applying a search, empty, or ready to show results. */}
            {isLoadingListings ? (
              <p className="user-panel-copy">Loading approved listings...</p>
            ) : isApplyingSearch ? (
              <p className="user-panel-copy">Searching approved listings...</p>
            ) : approvedListings.length === 0 ? (
              <p className="user-panel-copy">
                {hasActiveSearch
                  ? 'No approved listings matched your search.'
                  : 'No approved listings available yet.'}
              </p>
            ) : (
              <ul className="user-list applicant-scroll-list listing-results-list">
                {approvedListings.map((item) => {
                  const isFavourite = item.id ? favouriteOpportunityIds.has(item.id) : false
                  const isUpdatingFavourite = updatingFavouriteId === item.id

                  return (
                    <li key={item.id || item.title}>
                      <span>{item.type}</span>
                      <strong>{item.title}</strong>
                      {item.description ? <small className="user-item-meta">What this role involves: {item.description}</small> : null}
                      {item.meta ? <small className="user-item-meta">{item.meta}</small> : null}
                      {item.location ? <small className="user-item-meta">{item.location}</small> : null}
                      <small className="user-item-meta">Monthly stipend: {formatRandAmount(item.stipend)}</small>
                      {item.closingDate ? <small className="user-item-meta">Closing date: {formatShortDate(item.closingDate)}</small> : null}
                      <div className="listing-card-actions">
                        {item.id ? (
                          <Link
                            to={`/dashboard/listings/${item.id}`}
                            className="user-action-btn user-action-btn-inline provider-action-link"
                            aria-label={`View details for ${item.title}`}
                          >
                            View details
                          </Link>
                        ) : null}
                        {item.id ? (
                          <button
                            type="button"
                            className={`user-action-btn user-action-btn-inline favourite-toggle-btn${isFavourite ? ' favourite-toggle-btn-active' : ''}`}
                            onClick={() => handleFavouriteToggle(item)}
                            disabled={isUpdatingFavourite || isFavourite}
                            aria-pressed={isFavourite}
                            aria-label={isFavourite
                              ? `${item.title} is already favourited`
                              : `Favorite ${item.title}`}
                          >
                            {isUpdatingFavourite ? 'Updating...' : isFavourite ? 'Favorited' : 'Favorite'}
                          </button>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section
            id="applicant-panel-applications"
            role="tabpanel"
            aria-labelledby="applicant-tab-applications"
            hidden={activeApplicantTab !== 'applications'}
            className="applicant-tab-panel my-applications-panel"
          >
            <div className="provider-panel-head">
              <section>
                <p className="provider-panel-kicker">Applicant status tracker</p>
                <h2>My Applications</h2>
              </section>
              <span className="status-chip status-chip-soft">Live updates</span>
            </div>

            {isLoadingApplications ? (
              <p className="user-panel-copy">Loading your applications...</p>
            ) : applicationError ? (
              <p className="user-panel-copy">{applicationError}</p>
            ) : hasApplications ? (
              <ul className="user-list application-list applicant-scroll-list application-scroll-list">
                {dbApplications.map((application) => (
                  <li key={application.id} className="application-list-item">
                    <div className="application-list-row">
                      <strong>{application.title}</strong>
                      <span className={getApplicationStatusClass(application.status)}>{application.status}</span>
                    </div>
                    <small className="user-item-meta">{application.type}</small>
                    <small className="user-item-meta">{application.location}</small>
                    <small className="user-item-meta">
                      Applied on {formatApplicationDate(application.appliedAt)}
                    </small>
                    {application.closingDate ? (
                      <small className="user-item-meta">Closing date: {application.closingDate}</small>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="user-panel-copy">You have not submitted any applications yet.</p>
            )}
          </section>

          <section
            id="applicant-panel-favourites"
            role="tabpanel"
            aria-labelledby="applicant-tab-favourites"
            hidden={activeApplicantTab !== 'favourites'}
            className="applicant-tab-panel favourite-listings-panel"
          >
            <div className="provider-panel-head">
              <section>
                <p className="provider-panel-kicker">Applicant shortlist</p>
                <h2>Favourited Opportunities</h2>
              </section>
              <span className="status-chip status-chip-soft">
                {dbFavouriteListings.length === 1
                  ? '1 favourited'
                  : `${dbFavouriteListings.length} favourited`}
              </span>
            </div>

            {favouriteError ? <p className="user-panel-copy">{favouriteError}</p> : null}

            {isLoadingFavourites ? (
              <p className="user-panel-copy">Loading your favourited opportunities...</p>
            ) : hasFavouriteListings ? (
              <ul className="user-list applicant-scroll-list favourite-list">
                {dbFavouriteListings.map((item) => (
                  <li key={`favourite-${item.id}`}>
                    <span>{item.type}</span>
                    <strong>{item.title}</strong>
                    {item.location ? <small className="user-item-meta">{item.location}</small> : null}
                    <small className="user-item-meta">Monthly stipend: {formatRandAmount(item.stipend)}</small>
                    {item.closingDate ? (
                      <small className="user-item-meta">Closing date: {formatShortDate(item.closingDate)}</small>
                    ) : null}
                    <div className="listing-card-actions">
                      <Link
                        to={`/dashboard/listings/${item.id}`}
                        className="user-action-btn user-action-btn-inline provider-action-link"
                        aria-label={`View details for favourited ${item.title}`}
                      >
                        View details
                      </Link>
                      <button
                        type="button"
                        className="user-action-btn user-action-btn-inline favourite-toggle-btn favourite-toggle-btn-active"
                        onClick={() => handleFavouriteToggle(item)}
                        disabled={updatingFavouriteId === item.id}
                        aria-label={`Remove favourited ${item.title}`}
                      >
                        {updatingFavouriteId === item.id ? 'Updating...' : 'Remove'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="user-panel-copy">You have not favourited any opportunities yet.</p>
            )}
          </section>
        </article>
      </section>
      </section>
    </main>
  )
}
