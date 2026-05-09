// APPLICANT DASHBOARD: Main workspace for applicant users
// PURPOSE: Display available learnership listings and quick stats
// NOTE: Currently shows static/placeholder data; ready for Supabase integration

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'
import './UserPages.css'

// Quick statistics shown at top of dashboard
const quickStats = [
  { label: 'Available listings', value: '18' },
  { label: 'Saved opportunities', value: '12' },
  { label: 'Documents uploaded', value: '04' },
]

const availableListings = [
  {
    type: 'Learnership',
    title: 'Business Administration NQF 4',
    meta: 'Cape Town | Monthly stipend: R4,500 | Closes 25 Apr',
  },
  {
    type: 'Internship',
    title: 'Junior IT Support Internship',
    meta: 'Johannesburg | 12 months | Closes 30 Apr',
  },
  {
    type: 'Apprenticeship',
    title: 'Electrical Trade Apprenticeship',
    meta: 'Durban | Trade-tested path | Closes 04 May',
  },
]

const listingFilters = ['All', 'Learnership', 'Internship', 'Apprenticeship']
const applicationStatusLabels = {
  Pending: 'Pending',
  Shortlisted: 'Reviewed',
  Offered: 'Accepted',
  Rejected: 'Rejected',
}

function getApplicationStatusLabel(status) {
  return applicationStatusLabels[status] || status || 'Pending'
}

function getApplicationStatusClass(status) {
  if (status === 'Pending') {
    return 'status-chip status-chip-pending'
  }

  if (status === 'Reviewed') {
    return 'status-chip status-chip-reviewed'
  }

  if (status === 'Accepted') {
    return 'status-chip status-chip-accepted'
  }

  if (status === 'Rejected') {
    return 'status-chip status-chip-rejected'
  }

  return 'status-chip status-chip-soft'
}

function formatApplicationDate(value) {
  if (!value) {
    return 'Date unavailable'
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

function normalizeApplicationRow(row) {
  const opportunity = row.opportunities || row.opportunity || {}

  return {
    id: row.id,
    title: opportunity.title || 'Untitled opportunity',
    type: opportunity.type || 'Not specified',
    location: opportunity.location || 'Not specified',
    closingDate: opportunity.closing_date || '',
    appliedAt: row.applied_at || row.updated_at || '',
    status: getApplicationStatusLabel(row.status),
  }
}

function normalizeApprovedListing(row) {
  return {
    id: row.id,
    title: row.title || 'Untitled opportunity',
    type: row.type || 'Not specified',
    description: row.description || '',
    meta: row.meta,
    location: row.location || 'Not specified',
    closingDate: row.closingDate || row.closing_date || 'Not specified',
    status: row.status || 'Approved',
  }
}

function filterApprovedListings(listings, searchTerm, selectedType) {
  const normalizedSearchTerm = searchTerm.trim().toLowerCase()

  return listings.filter((listing) => {
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
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState('All')
  const [submittedSearchTerm, setSubmittedSearchTerm] = useState('')
  const [submittedType, setSubmittedType] = useState('All')
  const [searchError, setSearchError] = useState('')
  const [isLoadingListings, setIsLoadingListings] = useState(false)
  const [isLoadingApplications, setIsLoadingApplications] = useState(false)
  const [applicationError, setApplicationError] = useState('')
  const [isApplyingSearch, setIsApplyingSearch] = useState(false)
  const searchFeedbackTimeoutRef = useRef(null)
  const mountedRef = useRef(false)

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
        .select('id,title,type,description,location,closing_date,status')
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
  }, [applicantId, hasListingsProp, loadApplicantApplications])

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

  const hasActiveSearch = Boolean(submittedSearchTerm.trim() || submittedType !== 'All')
  const hasApplications = dbApplications.length > 0

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
        {quickStats.map((item) => (
          <article key={item.label} className="user-stat-card">
            <p>{item.label}</p>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className="listing-search-panel" aria-label="Listing search">
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

      <section className="user-content-grid">
        {!hasListingsProp ? (
          <article className="user-panel user-panel-alt my-applications-panel">
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
              <ul className="user-list application-list">
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
          </article>
        ) : null}

        <article className="user-panel">
          <h2>Current Listings and Internships</h2>
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
            <ul className="user-list">
              {approvedListings.map((item) => (
                <li key={item.id || item.title}>
                  <span>{item.type}</span>
                  <strong>{item.title}</strong>
                  {item.meta ? <small className="user-item-meta">{item.meta}</small> : null}
                  {item.location ? <small className="user-item-meta">{item.location}</small> : null}
                  {item.closingDate ? <small className="user-item-meta">{item.closingDate}</small> : null}
                  {item.id ? (
                    <Link
                      to={`/dashboard/listings/${item.id}`}
                      className="user-action-btn user-action-btn-inline provider-action-link"
                      aria-label={`View details for ${item.title}`}
                    >
                      View details
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
      </section>
    </main>
  )
}
