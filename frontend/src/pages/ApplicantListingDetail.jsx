/* istanbul ignore file */
/* eslint-disable react-refresh/only-export-components */
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

function getMissingProfileFields(profile) {
  const missing = []
  if (!profile) return ['profile (personal details)', 'CV']
  if (!profile.first_name?.trim()) missing.push('First name')
  if (!profile.last_name?.trim()) missing.push('Last name')
  if (!profile.phone?.trim()) missing.push('Phone number')
  if (!profile.location?.trim()) missing.push('Location')
  if (!profile.date_of_birth) missing.push('Date of birth')
  if (!profile.id_number?.trim()) missing.push('ID number')
  if (!profile.cv_url?.trim()) missing.push('CV')
  return missing
}

export { formatRandAmount, formatDate, isProfileReady, getMissingProfileFields }

export default function ApplicantListingDetail({ onLogout }) {
  const { listingId } = useParams()

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [listing, setListing] = useState(null)
  const [profile, setProfile] = useState(null)
  const [hasAlreadyApplied, setHasAlreadyApplied] = useState(false)
  const [applicationStatus, setApplicationStatus] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadListing = async () => {
      setIsLoading(true)
      setError('')
      setConfirmation('')
      setHasAlreadyApplied(false)
      setApplicationStatus('')

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

      if (profileError) {
        if (isMounted) {
          setError('Could not load your profile. Please try again.')
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

      let appliedRow = null
      if (profileRow?.id) {
        const { data: existingApplication, error: applicationError } = await supabase
          .from('applications')
          .select('id,status,applied_at')
          .eq('applicant_id', profileRow.id)
          .eq('opportunity_id', listingId)
          .maybeSingle()

        if (applicationError) {
          if (isMounted) {
            setError('Could not check whether you already applied. Please try again.')
            setIsLoading(false)
          }
          return
        }

        appliedRow = existingApplication || null
      }

      if (isMounted) {
        setProfile(profileRow ?? null)
        setListing(listingRow)
        setHasAlreadyApplied(Boolean(appliedRow?.id))
        setApplicationStatus(appliedRow?.status || '')
        setIsLoading(false)
      }
    }

    loadListing()

    return () => {
      isMounted = false
    }
  }, [listingId])

  const handleApply = async () => {
    if (!listing) {
      setError('Listing not available. Refresh and try again.')
      return
    }

    // Check required profile fields and collect what's missing
    const missing = []
    if (!profile) {
      missing.push('profile (personal details)')
      missing.push('CV')
    } else {
      if (!profile.first_name?.trim()) missing.push('first name')
      if (!profile.last_name?.trim()) missing.push('last name')
      if (!profile.phone?.trim()) missing.push('phone number')
      if (!profile.location?.trim()) missing.push('location')
      if (!profile.date_of_birth) missing.push('date of birth')
      if (!profile.id_number?.trim()) missing.push('ID number')
      if (!profile.cv_url?.trim()) missing.push('CV')
    }

    if (missing.length > 0) {
      setError(`Cannot apply: missing ${missing.join(', ')}.`)
      return
    }

    if (hasAlreadyApplied) {
      setError('You have already applied to this listing.')
      return
    }

    if (!hasSupabaseConfig) {
      setError('Supabase not configured. Applications cannot be submitted in demo mode.')
      return
    }

    setIsSubmitting(true)
    setError('')

    const applicationPayload = {
      applicant_id: profile.id,
      opportunity_id: listing.id,
      status: 'Pending',
    }

    let { error: insertError } = await supabase.from('applications').insert(applicationPayload)
    let usedStatusFallback = false

    if (insertError?.message?.includes('applications_status_check')) {
      usedStatusFallback = true
      const { error: fallbackError } = await supabase.from('applications').insert({
        applicant_id: profile.id,
        opportunity_id: listing.id,
      })
      insertError = fallbackError
    }

    if (insertError) {
      // Log full error to console for debugging and show a more specific message
      // to the user with available details.
      // Example: constraint violation, RLS deny, missing column, etc.
      // Show details if present to help diagnose.
      console.error('Application insert error:', insertError)
      const details = insertError.message || insertError.details || ''
      const fallbackHint = usedStatusFallback
        ? ' The database rejected the Pending status value, so it retried without sending status.'
        : ''
      setError(
        `Your application could not be submitted${details ? `: ${details}` : '. Please try again.'}${fallbackHint}`,
      )
      setIsSubmitting(false)
      return
    }

    setConfirmation('Your application has been submitted successfully. We used your saved profile and CV.')
    setHasAlreadyApplied(true)
    setApplicationStatus('Pending')
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
            <h2>Opportunity Overview</h2>
            {isLoading ? <p className="user-panel-copy">Loading listing details...</p> : null}
            {!isLoading && listing ? (
              <>
                <p className="user-panel-copy">{listing.description || 'No description provided.'}</p>
                <p className="user-item-meta"><strong>Type:</strong> {listing.type || 'Not specified'}</p>
                <p className="user-item-meta"><strong>Location:</strong> {listing.location || 'Not specified'}</p>
                <p className="user-item-meta"><strong>Duration:</strong> {listing.duration || 'Not specified'}</p>
                <p className="user-item-meta"><strong>Monthly stipend:</strong> {formatRandAmount(listing.stipend)}</p>
                <p className="user-item-meta"><strong>Closing date:</strong> {formatDate(listing.closing_date)}</p>
                <p className="user-panel-copy" style={{ marginTop: '0.6rem' }}>
                  Tip: Check the listing details above to confirm the role and stipend before applying.
                </p>
              </>
            ) : null}
          </article>

          <article className="user-panel applicant-detail-panel">
            <h2>Your Application</h2>
            {!isLoading && profile ? (
              <>
                <p className="user-panel-copy">We will submit your application using the profile below.</p>
                <p className="user-item-meta">Profile: {profile.first_name || 'Unknown'} {profile.last_name || ''}</p>
                <p className="user-item-meta">CV: {profile.cv_url || 'Not uploaded'}</p>
                <p className="user-item-meta">Status: {isProfileReady(profile) ? 'Ready to apply' : 'Profile incomplete'}</p>
                {!isProfileReady(profile) ? (
                  <div className="provider-note provider-checklist-note">
                    <p style={{ margin: '0 0 0.4rem 0' }}><strong>Missing profile information</strong></p>
                    <ul className="provider-checklist">
                      {getMissingProfileFields(profile).map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                    <p style={{ marginTop: '0.45rem' }} className="user-panel-copy">Please complete your profile and upload your CV to apply.</p>
                  </div>
                ) : null}
                {hasAlreadyApplied ? (
                  <p className="user-panel-copy applicant-detail-confirmation" role="status">
                    You have already applied to this listing{applicationStatus ? ` and your application is ${applicationStatus.toLowerCase()}` : ''}.
                  </p>
                ) : (
                  <button
                    type="button"
                    className="user-action-btn profile-save-btn applicant-apply-btn"
                    onClick={handleApply}
                    disabled={isSubmitting || !listing}
                  >
                    {isSubmitting ? 'Submitting...' : 'Apply now'}
                  </button>
                )}
                {!isLoading && error ? (
                  <p className="user-panel-copy applicant-detail-error" role="alert">
                    {error}
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