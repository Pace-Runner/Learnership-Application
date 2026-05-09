import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'
import './UserPages.css'

const DOCS_BUCKET = 'applicant-documents'
const APPLICATION_STATUS_OPTIONS = [
  { value: 'Received', label: 'Pending' },
  { value: 'Shortlisted', label: 'Reviewed' },
  { value: 'Offered', label: 'Accepted' },
  { value: 'Rejected', label: 'Rejected' },
]

function getApplicationStatusLabel(status) {
  return APPLICATION_STATUS_OPTIONS.find((option) => option.value === status)?.label || 'Pending'
}

function getApplicationStatusClass(status) {
  if (status === 'Offered') return 'status-chip status-chip-approved'
  if (status === 'Rejected') return 'status-chip status-chip-removed'
  if (status === 'Shortlisted') return 'status-chip status-chip-soft'
  return 'status-chip status-chip-pending'
}

export default function ProviderListingApplications() {
  const { listingId } = useParams()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [applications, setApplications] = useState([])
  const [listingTitle, setListingTitle] = useState('')
  const [updatingApplicationId, setUpdatingApplicationId] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadApplications = async () => {
      setIsLoading(true)
      setError('')
      setStatusMessage('')

      if (!hasSupabaseConfig) {
        if (isMounted) {
          setError('Supabase not configured. Data unavailable in demo mode.')
          setIsLoading(false)
        }
        return
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      const email = sessionData?.session?.user?.email

      if (sessionError || !email) {
        if (isMounted) {
          setError('You must be signed in as a Provider to view applicants.')
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
          setError('Provider user record was not found.')
          setIsLoading(false)
        }
        return
      }

      const { data: providerRow, error: providerError } = await supabase
        .from('provider_profiles')
        .select('id')
        .eq('user_id', userRow.id)
        .maybeSingle()

      if (providerError || !providerRow?.id) {
        if (isMounted) {
          setError('Provider profile was not found.')
          setIsLoading(false)
        }
        return
      }

      const { data: listingRow, error: listingError } = await supabase
        .from('opportunities')
        .select('id,title,provider_id')
        .eq('id', listingId)
        .maybeSingle()

      if (listingError || !listingRow || listingRow.provider_id !== providerRow.id) {
        if (isMounted) {
          setError('Listing not found or you do not have permission to view it.')
          setIsLoading(false)
        }
        return
      }

      if (isMounted) {
        setListingTitle(listingRow.title || '')
      }

      const { data: applicationRows, error: applicationError } = await supabase
        .from('applications')
        .select('id,applicant_id,status,applied_at,applicant_profiles:applicant_id(user_id,first_name,last_name,about_me,cv_url)')
        .eq('opportunity_id', listingId)
        .order('applied_at', { ascending: false })

      if (applicationError) {
        if (isMounted) {
          setError('Could not load applications. Check RLS policies.')
          setIsLoading(false)
        }
        return
      }

      const normalizedApplications = (applicationRows || []).map((row) => ({
        id: row.id,
        applicantId: row.applicant_id,
        appliedAt: row.applied_at,
        status: row.status || 'Received',
        statusDraft: row.status || 'Received',
        applicant: row.applicant_profiles || {},
      }))

      const withCvLinks = await Promise.all(
        normalizedApplications.map(async (item) => {
          const cv = item.applicant?.cv_url || ''

          if (!cv) {
            return { ...item, cvLink: '' }
          }

          if (/^https?:\/\//i.test(cv)) {
            return { ...item, cvLink: cv }
          }

          const authUserId = item.applicant?.user_id || ''
          const normalizedPath = cv.includes('/') ? cv : `${authUserId}/${cv}`

          try {
            const { data } = await supabase.storage.from(DOCS_BUCKET).createSignedUrl(normalizedPath, 60 * 10)
            return { ...item, cvLink: data?.signedUrl || '' }
          } catch {
            return { ...item, cvLink: '' }
          }
        }),
      )

      if (isMounted) {
        setApplications(withCvLinks)
        setIsLoading(false)
      }
    }

    loadApplications()

    return () => {
      isMounted = false
    }
  }, [listingId])

  const handleStatusDraftChange = (applicationId, nextStatus) => {
    setApplications((current) =>
      current.map((application) => (
        application.id === applicationId
          ? { ...application, statusDraft: nextStatus }
          : application
      )),
    )
  }

  const handleStatusUpdate = async (application) => {
    const nextStatus = application.statusDraft || application.status || 'Received'
    const applicantName = `${application.applicant?.first_name || 'Applicant'} ${application.applicant?.last_name || ''}`.trim()

    setError('')
    setStatusMessage('')
    setUpdatingApplicationId(application.id)

    const { error: updateError } = await supabase
      .from('applications')
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq('id', application.id)

    if (updateError) {
      setUpdatingApplicationId('')
      setError('Application status could not be updated. Please try again.')
      return
    }

    let notificationError = null

    if (application.applicant?.user_id) {
      const notificationMessage = `Your application for ${listingTitle || 'this listing'} is now ${getApplicationStatusLabel(nextStatus)}.`
      const result = await supabase.from('notifications').insert({
        user_id: application.applicant.user_id,
        type: 'status_update',
        message: notificationMessage,
      })
      notificationError = result.error
    }

    setApplications((current) =>
      current.map((currentApplication) => (
        currentApplication.id === application.id
          ? { ...currentApplication, status: nextStatus, statusDraft: nextStatus }
          : currentApplication
      )),
    )
    setUpdatingApplicationId('')
    setStatusMessage(
      notificationError
        ? `Updated ${applicantName} to ${getApplicationStatusLabel(nextStatus)}, but notification could not be sent.`
        : `Updated ${applicantName} to ${getApplicationStatusLabel(nextStatus)}.`,
    )
  }

  return (
    <main className="user-page provider-theme provider-shell">
      <section className="user-page-inner">
        <header className="user-hero provider-hero">
          <section>
            <p className="user-kicker">Provider Workspace</p>
            <h1>Applicants for listing</h1>
            <p className="user-intro">View all applicants who applied to this listing.</p>
          </section>

          <nav className="user-nav-actions" aria-label="Provider listing navigation">
            <Link to="/provider" className="user-link-btn">
              Back to Dashboard
            </Link>
          </nav>
        </header>

        <section className="user-panel provider-panel">
          <h2>{listingTitle ? `Applicants - ${listingTitle}` : 'Applicants'}</h2>

          {isLoading ? <p className="user-panel-copy">Loading applicants...</p> : null}
          {!isLoading && error ? <p className="user-panel-copy">{error}</p> : null}
          {!isLoading && !error && statusMessage ? <p className="user-panel-copy">{statusMessage}</p> : null}

          {!isLoading && !error ? (
            applications.length === 0 ? (
              <p className="user-panel-copy">No applications have been submitted yet.</p>
            ) : (
              <ul className="user-list provider-list">
                {applications.map((application) => (
                  <li key={application.id}>
                    <strong>
                      {application.applicant?.first_name || 'Applicant'} {application.applicant?.last_name || ''}
                    </strong>
                    <small className={getApplicationStatusClass(application.status)}>
                      Current status: {getApplicationStatusLabel(application.status)}
                    </small>
                    {application.appliedAt ? (
                      <small className="user-item-meta">
                        Applied: {new Date(application.appliedAt).toLocaleDateString()}
                      </small>
                    ) : null}
                    <p className="user-item-meta">{application.applicant?.about_me || 'No profile summary'}</p>
                    {application.cvLink ? (
                      <p>
                        <a href={application.cvLink} target="_blank" rel="noopener noreferrer">
                          Download CV
                        </a>
                      </p>
                    ) : (
                      <p className="user-item-meta">No CV uploaded</p>
                    )}
                    <div className="provider-application-status-row">
                      <label htmlFor={`application-status-${application.id}`} className="provider-application-status-label">
                        Application status
                      </label>
                      <div className="provider-application-status-controls">
                        <select
                          id={`application-status-${application.id}`}
                          value={application.statusDraft}
                          onChange={(event) => handleStatusDraftChange(application.id, event.target.value)}
                          aria-label={`Application status for ${application.applicant?.first_name || 'Applicant'} ${application.applicant?.last_name || ''}`.trim()}
                        >
                          {APPLICATION_STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="user-action-btn provider-listing-btn"
                          disabled={updatingApplicationId === application.id || application.statusDraft === application.status}
                          onClick={() => handleStatusUpdate(application)}
                        >
                          {updatingApplicationId === application.id ? 'Updating...' : 'Update status'}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </section>
      </section>
    </main>
  )
}
