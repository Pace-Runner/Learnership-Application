// APPLICANT DASHBOARD: Main workspace for applicant users
// PURPOSE: Display available learnership listings and quick stats
// NOTE: Currently shows static/placeholder data; ready for Supabase integration

import { useEffect, useMemo, useRef, useState } from 'react'
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
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState('All')
  const [submittedSearchTerm, setSubmittedSearchTerm] = useState('')
  const [submittedType, setSubmittedType] = useState('All')
  const [searchError, setSearchError] = useState('')
  const [isLoadingListings, setIsLoadingListings] = useState(false)
  const [isApplyingSearch, setIsApplyingSearch] = useState(false)
  const searchFeedbackTimeoutRef = useRef(null)

  useEffect(() => {
    if (hasListingsProp || !hasSupabaseConfig) {
      return
    }

    let isMounted = true

    const fetchApprovedListings = async () => {
      setIsLoadingListings(true)
      setSearchError('')

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
        <article className="user-panel">
          <h2>Current Listings and Internships</h2>
          {searchError ? <p className="user-panel-copy">{searchError}</p> : null}
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
