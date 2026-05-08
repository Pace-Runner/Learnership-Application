import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'
import './UserPages.css'

function formatRandAmount(value) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return 'Not specified'
  }

  return `R${parsed.toLocaleString('en-ZA', { maximumFractionDigits: 2 })}`
}

function formatDate(value) {
  if (!value) {
    return 'Not specified'
  }

  return value
}

function isProfileReady(profile) {
  return Boolean(
    profile?.id
      && profile?.first_name?.trim()
      && profile?.last_name?.trim()
      && profile?.phone?.trim()
      && profile?.location?.trim()
      && profile?.date_of_birth
      && profile?.id_number?.trim()
      && profile?.cv_url?.trim(),
  )
}

export default function ApplicantListingDetail({ onLogout }) {
  const { listingId } = useParams()

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [listing, setListing] = useState(null)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    let isMounted = true

    const loadListing = async () => {
      setIsLoading(true)
      setError('')
      setConfirmation('')

      if (!hasSupabaseConfig) {
        if (isMounted) {
          setError('Supabase not configured. Applications cannot be submitted in demo mode.')
          setIsLoading(false)
        }
        return
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      const email = sessionData?.session?.user?.email

      if (sessionError || !email) {
        if (isMounted) {
          setError('You must be signed in as an Applicant to view this listing.')
          setIsLoading(false)
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
          setError('Applicant account details were not found.')
          setIsLoading(false)
        }
        return
      }

      const { data: profileRow, error: profileError } = await supabase
        .from('applicant_profiles')
        .select('id,user_id,first_name,last_name,phone,location,date_of_birth,id_number,cv_url,about_me')
        .eq('user_id', userRow.id)
        .maybeSingle()

      if (profileError || !profileRow?.id) {
        if (isMounted) {
          setError('Complete your profile and upload a CV before applying.')
          setIsLoading(false)
        }
        return
      }

      const { data: listingRow, error: listingError } = await supabase
        .from('opportunities')
        .select('id,title,type,description,stipend,location,duration,closing_date,status')
        .eq('id', listingId)
        .maybeSingle()

      if (listingError || !listingRow) {
        if (isMounted) {
          setError('Listing not found or you do not have permission to view it.')
          setIsLoading(false)
        }
        return
      }

      if (listingRow.status && listingRow.status !== 'Approved') {
        if (isMounted) {
          setError('This listing is not open for applications yet.')
          setIsLoading(false)
        }
        return
      }

      if (isMounted) {
        setProfile(profileRow)
        setListing(listingRow)
        setIsLoading(false)
      }
    }

    loadListing()

    return () => {
      isMounted = false
    }
  }, [listingId])

  const handleApply = async () => {
    if (!listing || !profile || !isProfileReady(profile)) {
      setError('Complete your profile and upload a CV before applying.')
      return
    }

    if (!hasSupabaseConfig) {
      setError('Supabase not configured. Applications cannot be submitted in demo mode.')
      return
    }

    setIsSubmitting(true)
    setError('')

    const { error: insertError } = await supabase.from('applications').insert({
      applicant_id: profile.id,
      opportunity_id: listing.id,
      status: 'Pending',
    })

    if (insertError) {
      setError('Your application could not be submitted. Please try again.')
      setIsSubmitting(false)
      return
    }

    setConfirmation('Your application has been submitted successfully. We used your saved profile and CV.')
    setIsSubmitting(false)
  }

  return (
    <main className="user-page applicant-theme profile-shell">
      <section className="user-page-inner">
        <header className="user-hero">
          <section>
            <p className="user-kicker">Applicant Workspace</p>
            <h1>{listing?.title || 'Listing details'}</h1>
            <p className="user-intro">
              Review the opportunity, then apply once using the profile and CV you already saved.
            </p>
          </section>

          <nav className="user-nav-actions" aria-label="Applicant listing navigation">
            <Link to="/dashboard" className="user-link-btn">
              Back to listings
            </Link>
            <button type="button" onClick={onLogout} className="user-logout-btn">
              Logout
            </button>
          </nav>
        </header>

        <section className="user-content-grid applicant-detail-grid">
          <article className="user-panel applicant-detail-panel">
            <h2>Opportunity overview</h2>
            {isLoading ? <p className="user-panel-copy">Loading listing details...</p> : null}
            {!isLoading && error ? <p className="user-panel-copy applicant-detail-error">{error}</p> : null}
            {!isLoading && listing ? (
              <>
                <p className="user-panel-copy">{listing.description || 'No description provided.'}</p>
                <p className="user-item-meta">Type: {listing.type || 'Not specified'}</p>
                <p className="user-item-meta">Location: {listing.location || 'Not specified'}</p>
                <p className="user-item-meta">Duration: {listing.duration || 'Not specified'}</p>
                <p className="user-item-meta">Stipend: {formatRandAmount(listing.stipend)}</p>
                <p className="user-item-meta">Closing date: {formatDate(listing.closing_date)}</p>
              </>
            ) : null}
          </article>

          <article className="user-panel applicant-detail-panel">
            <h2>Your application</h2>
            {!isLoading && profile ? (
              <>
                <p className="user-panel-copy">
                  We will submit your application using the profile below.
                </p>
                <p className="user-item-meta">
                  Profile: {profile.first_name || 'Unknown'} {profile.last_name || ''}
                </p>
                <p className="user-item-meta">CV: {profile.cv_url || 'Not uploaded'}</p>
                <p className="user-item-meta">
                  Status: {isProfileReady(profile) ? 'Ready to apply' : 'Profile incomplete'}
                </p>
                <button
                  type="button"
                  className="user-action-btn profile-save-btn applicant-apply-btn"
                  onClick={handleApply}
                  disabled={isSubmitting || !listing}
                >
                  {isSubmitting ? 'Submitting...' : 'Apply now'}
                </button>
                {!isProfileReady(profile) ? (
                  <p className="user-panel-copy applicant-detail-error" role="alert">
                    You must complete your profile and upload a CV before applying. Click "Profile" to update your details.
                  </p>
                ) : null}
                {confirmation ? (
                  <p className="user-panel-copy applicant-detail-confirmation" role="status">
                    {confirmation}
                  </p>
                ) : null}
              </>
            ) : null}
          </article>
        </section>
      </section>
    </main>
  )
}