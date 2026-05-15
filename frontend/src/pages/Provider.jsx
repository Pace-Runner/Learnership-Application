import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'
import './UserPages.css'

const providerStatusFilters = [
  { value: 'All', label: 'All' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Declined', label: 'Declined' },
]
const fallbackListings = [
  {
    id: 'sample-1',
    title: 'Business Administration NQF 4',
    type: 'Learnership',
    location: 'Cape Town',
    duration: '12 months',
    status: 'Pending',
    closing_date: '2026-05-28',
  },
  {
    id: 'sample-2',
    title: 'Electrical Trade Apprenticeship',
    type: 'Apprenticeship',
    location: 'Durban',
    duration: '18 months',
    status: 'Approved',
    closing_date: '2026-06-10',
  },
]

function getStatusClass(status) {
  if (status === 'Approved') return 'status-chip status-chip-approved'
  if (status === 'Removed' || status === 'Declined') return 'status-chip status-chip-removed'
  return 'status-chip status-chip-pending'
}

function getDisplayStatus(status) {
  if (status === 'Removed' || status === 'Declined') return 'Declined'
  if (status === 'Approved') return 'Approved'
  if (status === 'Pending') return 'Pending'
  return status || 'Pending'
}

function isDeclinedStatus(status) {
  return status === 'Removed' || status === 'Declined'
}

function filterListingsByStatus(listings, selectedStatus) {
  if (selectedStatus === 'All') {
    return listings
  }

  return listings.filter((listing) => getDisplayStatus(listing.status) === selectedStatus)
}

function formatClosingDate(value) {
  if (!value) return 'Not specified'
  return value
}

function formatRandAmount(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 'R0'
  return `R${parsed.toLocaleString('en-ZA', { maximumFractionDigits: 2 })}`
}

export default function Provider({ onLogout }) {
  const navigate = useNavigate()
  const [listings, setListings] = useState([])
  const [isLoadingListings, setIsLoadingListings] = useState(true)
  const [listingsError, setListingsError] = useState('')
  const [providerId, setProviderId] = useState('')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('All')

  const handleOpenProfile = () => {
    navigate('/provider/profile')
  }

  const handleCreateListing = () => {
    navigate('/provider/listings/new')
  }

  const handleEditListing = (listing) => {
    if (listing.status === 'Approved') {
      const isConfirmed = window.confirm(
        'This listing is already approved. Do you want to continue editing it?',
      )

      if (!isConfirmed) {
        return
      }
    }

    navigate(`/provider/listings/${listing.id}/edit`)
  }

  const handleViewApplicants = (listing) => {
    navigate(`/provider/listings/${listing.id}/applications`)
  }

  const handleDeleteListing = async (listing) => {
    const baseMessage = 'Are you sure you want to delete this listing?'
    const approvedMessage =
      'This listing is already approved. Deleting it may affect live applicants. Delete anyway?'

    const isConfirmed = window.confirm(listing.status === 'Approved' ? approvedMessage : baseMessage)

    if (!isConfirmed) {
      return
    }

    if (!hasSupabaseConfig) {
      setListings((current) => current.filter((item) => item.id !== listing.id))
      return
    }

    if (!providerId) {
      setListingsError('Could not validate ownership for delete action.')
      return
    }

    const { error: deleteRequirementError } = await supabase
      .from('opportunity_requirements')
      .delete()
      .eq('opportunity_id', listing.id)

    if (deleteRequirementError) {
      setListingsError('Listing could not be deleted. Please try again.')
      return
    }

    const { error: deleteOpportunityError } = await supabase
      .from('opportunities')
      .delete()
      .eq('id', listing.id)
      .eq('provider_id', providerId)

    if (deleteOpportunityError) {
      setListingsError('Listing could not be deleted. Please try again.')
      return
    }

    setListings((current) => current.filter((item) => item.id !== listing.id))
  }

  useEffect(() => {
    let isMounted = true

    const fetchProviderListings = async () => {
      setIsLoadingListings(true)
      setListingsError('')

      if (!hasSupabaseConfig) {
        if (isMounted) {
          setListings(filterListingsByStatus(fallbackListings, selectedStatusFilter))
          setIsLoadingListings(false)
        }
        return
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      const email = sessionData?.session?.user?.email

      // For local dev/testing: if no session, use fallback listings.
      if (import.meta.env.DEV && (sessionError || !email)) {
        if (isMounted) {
          setListings(filterListingsByStatus(fallbackListings, selectedStatusFilter))
          setIsLoadingListings(false)
        }
        return
      }

      if (sessionError || !email) {
        if (isMounted) {
          setListings([])
          setListingsError('Could not load your provider account details.')
          setIsLoadingListings(false)
        }
        return
      }

      const { data: userRow, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      if (userError || !userRow?.id) {
        if (isMounted) {
          setListings([])
          setListingsError('Provider user record was not found.')
          setIsLoadingListings(false)
        }
        return
      }

      const { data: providerRow, error: providerError } = await supabase
        .from('provider_profiles')
        .select('id')
        .eq('user_id', userRow.id)
        .maybeSingle()

      if (providerError) {
        if (isMounted) {
          setListings([])
          setListingsError('Provider profile was not found. Please contact support.')
          setIsLoadingListings(false)
        }
        return
      }

      if (!providerRow?.id) {
        if (isMounted) {
          setListings([])
          setListingsError('Complete your provider profile before accessing the workspace.')
          setIsLoadingListings(false)
        }
        return
      }

      // Load only the signed-in provider's listings so the dashboard reflects that provider's current submission statuses.
      if (isMounted) {
        setProviderId(providerRow.id)
      }

      let opportunityQuery = supabase
        .from('opportunities')
        .select('id,title,type,stipend,location,duration,closing_date,status,created_at')
        .eq('provider_id', providerRow.id)

      if (selectedStatusFilter === 'Pending') {
        opportunityQuery = opportunityQuery.eq('status', 'Pending')
      } else if (selectedStatusFilter === 'Approved') {
        opportunityQuery = opportunityQuery.eq('status', 'Approved')
      } else if (selectedStatusFilter === 'Declined') {
        opportunityQuery = opportunityQuery.in('status', ['Declined', 'Removed'])
      }

      const { data: opportunityRows, error: opportunityError } = await opportunityQuery.order('created_at', { ascending: false })

      if (opportunityError) {
        if (isMounted) {
          setListings([])
          setListingsError('Your listings could not be loaded right now.')
          setIsLoadingListings(false)
        }
        return
      }

      if (isMounted) {
        setListings(opportunityRows || [])
        setIsLoadingListings(false)
      }
    }

    fetchProviderListings()

    return () => {
      isMounted = false
    }
  }, [selectedStatusFilter])

  const providerStats = useMemo(() => {
    const activeCount = listings.filter((item) => !isDeclinedStatus(item.status)).length
    const pendingCount = listings.filter((item) => getDisplayStatus(item.status) === 'Pending').length
    const approvedCount = listings.filter((item) => getDisplayStatus(item.status) === 'Approved').length

    // These dashboard totals give providers a quick view of what is still pending review versus already approved.
    return [
      { label: 'Active listings', value: String(activeCount).padStart(2, '0') },
      { label: 'Pending approval', value: String(pendingCount).padStart(2, '0') },
      { label: 'Approved listings', value: String(approvedCount).padStart(2, '0') },
    ]
  }, [listings])

  return (
    <main className="user-page provider-theme provider-shell">
      <section className="user-page-inner">
        <header className="user-hero provider-hero">
          <section>
            <p className="user-kicker">Provider Workspace</p>
            <h1>Manage your learnership pipeline</h1>
            <p className="user-intro">
              Post opportunities, review applicant fit, and keep each listing aligned with the
              programme requirements before it goes live.
            </p>
          </section>

          <nav className="user-nav-actions" aria-label="Provider actions">
            <button type="button" className="user-link-btn" onClick={handleOpenProfile}>
              Profile
            </button>
            <button type="button" className="user-link-btn" onClick={handleCreateListing}>
              New Listing
            </button>
            <button onClick={onLogout} className="user-logout-btn">
              Logout
            </button>
          </nav>
        </header>

        <section className="user-stat-grid" aria-label="Provider quick stats">
          {providerStats.map((item) => (
            <article key={item.label} className="user-stat-card">
              <p>{item.label}</p>
              <strong>{item.value}</strong>
            </article>
          ))}
        </section>

        <section className="provider-grid provider-grid-single">
          <article className="user-panel provider-panel">
            <header className="provider-panel-head">
              <section>
                <p className="provider-panel-kicker">Listing overview</p>
                <h2>Your submitted listings</h2>
              </section>
              <span className="status-chip status-chip-soft">Status updates</span>
            </header>

            <div className="provider-status-filter-row" role="tablist" aria-label="Filter listings by status">
              {providerStatusFilters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  role="tab"
                  aria-selected={selectedStatusFilter === filter.value}
                  className={`user-action-btn provider-status-filter-btn${selectedStatusFilter === filter.value ? ' provider-status-filter-btn-active' : ''}`}
                  onClick={() => setSelectedStatusFilter(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {isLoadingListings ? <p className="user-panel-copy">Loading your listings...</p> : null}
            {!isLoadingListings && listingsError ? <p className="user-panel-copy">{listingsError}</p> : null}

            {!isLoadingListings && !listingsError ? (
              listings.length === 0 ? (
                <p className="user-panel-copy">You have not submitted any listings yet.</p>
              ) : (
                <ul className="user-list provider-list">
                  {listings.map((item) => (
                    <li key={item.id}>
                      <span>{item.type || 'Opportunity'}</span>
                      <strong>{item.title || 'Untitled listing'}</strong>
                      <small className="user-item-meta">Stipend: {formatRandAmount(item.stipend)}</small>
                      <small className="user-item-meta">Location: {item.location || 'Not specified'}</small>
                      <small className="user-item-meta">Duration: {item.duration || 'Not specified'}</small>
                      <small className="provider-detail">Closing date: {formatClosingDate(item.closing_date)}</small>
                      <small className={getStatusClass(item.status)}>Status: {getDisplayStatus(item.status)}</small>
                      <div className="provider-listing-controls">
                        <button
                          type="button"
                          className="user-action-btn provider-listing-btn"
                          onClick={() => handleViewApplicants(item)}
                        >
                          View applicants
                        </button>
                        <button
                          type="button"
                          className="user-action-btn provider-listing-btn"
                          onClick={() => handleEditListing(item)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="user-action-btn provider-listing-btn provider-delete-btn"
                          onClick={() => handleDeleteListing(item)}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </article>

          <article className="user-panel provider-panel">
            <header className="provider-panel-head">
              <section>
                <p className="provider-panel-kicker">Posting checklist</p>
                <h2>Before you publish</h2>
              </section>
              <span className="status-chip status-chip-soft">Ready for review</span>
            </header>

            <p className="provider-note provider-checklist-note">
              Make sure the listing clearly states the qualification level, closing date, location,
              stipend, and the kind of applicant you want to attract.
            </p>

            <ul className="provider-checklist">
              <li>Qualification and NQF level confirmed</li>
              <li>Applicant profile requirements written clearly</li>
              <li>Posting dates and contact details checked</li>
              <li>Compliance docs attached before publish</li>
            </ul>
          </article>
        </section>
      </section>
    </main>
  )
}
