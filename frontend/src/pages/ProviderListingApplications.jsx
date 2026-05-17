/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'
import './UserPages.css'

const DOCS_BUCKET = 'applicant-documents'
const APPLICATION_STATUS_OPTIONS = [
  { value: 'Pending', label: 'Pending' },
  { value: 'Shortlisted', label: 'Reviewed' },
  { value: 'Offered', label: 'Accepted' },
  { value: 'Rejected', label: 'Rejected' },
]

function getApplicationStatusLabel(status) {
  if (status === 'Received') return 'Pending'
  return APPLICATION_STATUS_OPTIONS.find((option) => option.value === status)?.label || 'Pending'
}

function normalizeApplicationStatus(status) {
  return status === 'Received' ? 'Pending' : status || 'Pending'
}

function getApplicationStatusClass(status) {
  if (status === 'Offered') return 'status-chip status-chip-approved'
  if (status === 'Rejected') return 'status-chip status-chip-removed'
  if (status === 'Shortlisted') return 'status-chip status-chip-soft'
  return 'status-chip status-chip-pending'
}

function formatRandAmount(value) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return 'Not specified'
  }

  return `R${parsed.toLocaleString('en-ZA', { maximumFractionDigits: 2 })}`
}

function formatShortDate(value) {
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

export default function ProviderListingApplications() {
  const { listingId } = useParams()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [applications, setApplications] = useState([])
  const [listingTitle, setListingTitle] = useState('')
  const [listingMeta, setListingMeta] = useState({})
  const [selectedApplicant, setSelectedApplicant] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
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
        .select('id,title,provider_id,type,location,closing_date,stipend,description')
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
        setListingMeta({
          type: listingRow.type || '',
          location: listingRow.location || '',
          closingDate: listingRow.closing_date || '',
          monthlyStipend: listingRow.stipend || '',
          description: listingRow.description || '',
        })
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
        status: normalizeApplicationStatus(row.status),
        statusDraft: normalizeApplicationStatus(row.status),
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
          let normalizedPath = cv.includes('/') ? cv : authUserId ? `${authUserId}/${cv}` : cv

          // Helper to resolve signed or public URL, with bucket fallback if bucket contains a folder
          const resolveLink = async (bucket, path) => {
            // try signed URL first
            try {
              const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10)
              if (signed?.data?.signedUrl) return signed.data.signedUrl

              // if error indicates bucket not found, attempt to split bucket into root + prefix
              if (signed?.error && ((signed.error.message || '').toLowerCase().includes('bucket not found') || signed.error.status === 404)) {
                if (bucket.includes('/')) {
                  const [rootBucket, ...rest] = bucket.split('/')
                  const prefix = rest.join('/')
                  const altPath = prefix ? `${prefix}/${path}` : path
                  const altSigned = await supabase.storage.from(rootBucket).createSignedUrl(altPath, 60 * 10)
                  if (altSigned?.data?.signedUrl) return altSigned.data.signedUrl

                  const altPublic = await supabase.storage.from(rootBucket).getPublicUrl(altPath)
                  return altPublic?.data?.publicUrl || ''
                }
              }

              // fallback to public url on same bucket
              const pub = await supabase.storage.from(bucket).getPublicUrl(path)
              return pub?.data?.publicUrl || ''
            } catch (err) {
              // If createSignedUrl threw, try public URL and bucket-split fallback
              console.debug('resolveLink createSignedUrl error', err)
              try {
                const pub = await supabase.storage.from(bucket).getPublicUrl(path)
                if (pub?.data?.publicUrl) return pub.data.publicUrl
              } catch (err2) {
                console.debug('resolveLink getPublicUrl error', err2)
                // try splitting bucket if it contains '/'
                if (bucket.includes('/')) {
                  const [rootBucket, ...rest] = bucket.split('/')
                  const prefix = rest.join('/')
                  const altPath = prefix ? `${prefix}/${path}` : path
                  try {
                    const altSigned = await supabase.storage.from(rootBucket).createSignedUrl(altPath, 60 * 10)
                    if (altSigned?.data?.signedUrl) return altSigned.data.signedUrl
                  } catch (err3) {
                    console.debug('resolveLink altSigned error', err3)
                  }
                  try {
                    const altPublic = await supabase.storage.from(rootBucket).getPublicUrl(altPath)
                    return altPublic?.data?.publicUrl || ''
                  } catch (err4) {
                    console.debug('resolveLink altPublic error', err4)
                  }
                }
              }
              return ''
            }
          }

          const cvLink = await resolveLink(DOCS_BUCKET, normalizedPath)
          return { ...item, cvLink: cvLink || '' }
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

    setSelectedApplicant((current) => (
      current?.id === applicationId
        ? { ...current, statusDraft: nextStatus }
        : current
    ))
  }

  const handleStatusUpdate = async (application) => {
    const nextStatus = application.statusDraft || application.status || 'Pending'
    const applicantName = `${application.applicant?.first_name || 'Applicant'} ${application.applicant?.last_name || ''}`.trim()
    const statusLabel = getApplicationStatusLabel(nextStatus)

    setError('')
    setStatusMessage('')
    setUpdatingApplicationId(application.id)

    const updateApplicationStatus = async (statusValue) => {
      const { error } = await supabase
        .from('applications')
        .update({ status: statusValue, updated_at: new Date().toISOString() })
        .eq('id', application.id)

      return error
    }

    let updateError = await updateApplicationStatus(nextStatus)

    if (updateError && nextStatus === 'Pending') {
      updateError = await updateApplicationStatus('Received')
    }

    if (updateError) {
      setUpdatingApplicationId('')
      setError('Application status could not be updated. Please try again.')
      return
    }

    let notificationError = null
    let emailError = null
    const notificationMessage = `Your application for ${listingTitle || 'this listing'} is now ${statusLabel}.`

    const deliveryResult = await supabase.functions.invoke('send-status-email', {
      body: {
        applicationId: application.id,
        applicantName,
        listingTitle: listingTitle || 'this listing',
        statusLabel,
      },
    })

    if (deliveryResult.error) {
      notificationError = deliveryResult.error
      emailError = deliveryResult.error
    } else {
      notificationError = deliveryResult.data?.notificationSent ? null : { message: 'In-app notification was not sent.' }
      emailError = deliveryResult.data?.emailSent ? null : { message: 'Email notification was not sent.' }
    }

    if (notificationError && application.applicant?.user_id) {
      const fallbackNotification = await supabase.from('notifications').insert({
        user_id: application.applicant.user_id,
        type: 'status_update',
        message: notificationMessage,
      })

      notificationError = fallbackNotification.error
    }

    setApplications((current) =>
      current.map((currentApplication) => (
        currentApplication.id === application.id
          ? { ...currentApplication, status: nextStatus, statusDraft: nextStatus }
          : currentApplication
      )),
    )
    setSelectedApplicant((current) => (
      current?.id === application.id
        ? { ...current, status: nextStatus, statusDraft: nextStatus }
        : current
    ))
    setUpdatingApplicationId('')

    const failedDeliveries = []

    if (notificationError) {
      failedDeliveries.push('the in-app notification')
    }

    if (emailError) {
      failedDeliveries.push('the email notification')
    }

    if (failedDeliveries.length > 0) {
      const joinedFailures = failedDeliveries.length === 1
        ? failedDeliveries[0]
        : `${failedDeliveries.slice(0, -1).join(', ')} and ${failedDeliveries[failedDeliveries.length - 1]}`

      setStatusMessage(`Updated ${applicantName} to ${statusLabel}, but ${joinedFailures} could not be sent.`)
      return
    }

    setStatusMessage(`Updated ${applicantName} to ${statusLabel}.`)
  }

  const openApplicantModal = (application) => {
    setSelectedApplicant(application)
    setIsModalOpen(true)
  }

  const closeApplicantModal = () => {
    setSelectedApplicant(null)
    setIsModalOpen(false)
  }

  return (
    <main className="user-page provider-theme provider-shell">
      <section className="user-page-inner">
        <header className="user-hero provider-hero">
          <section>
            <p className="user-kicker">Provider Workspace</p>
            <h1>Applicants for listing</h1>
            <p className="user-intro">
              Review the listing details first, then update each applicant&apos;s status as they move through your pipeline.
            </p>
          </section>

          <nav className="user-nav-actions" aria-label="Provider listing navigation">
            <Link to="/provider" className="user-link-btn">
              Back to Dashboard
            </Link>
          </nav>
        </header>

        <section className="user-panel provider-panel">
          <h2>{listingTitle ? `Applicants - ${listingTitle}` : 'Applicants'}</h2>
          {listingMeta && listingMeta.type ? (
            <div className="provider-detail" style={{ marginTop: '0.5rem' }}>
              <small>{listingMeta.type} • {listingMeta.location}</small>
              <div><strong>Monthly stipend:</strong> {formatRandAmount(listingMeta.monthlyStipend)}</div>
              <div><strong>Closing date:</strong> {formatShortDate(listingMeta.closingDate)}</div>
              {listingMeta.description ? <p style={{ marginTop: '0.45rem' }}><strong>Listing summary:</strong> {listingMeta.description}</p> : null}
            </div>
          ) : null}

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
                    <p className="user-item-meta">{application.applicant?.about_me || 'No profile summary provided yet.'}</p>
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
                        <button
                          type="button"
                          className="user-action-btn"
                          onClick={() => openApplicantModal(application)}
                        >
                          View details
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
      {isModalOpen && selectedApplicant ? (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.6)', display: 'grid', placeItems: 'center' }}>
          <div className="user-panel" style={{ width: 'min(760px, 94%)' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Applicant details</h3>
              <button className="user-link-btn" onClick={closeApplicantModal}>Close</button>
            </header>
            <div style={{ marginTop: '0.6rem' }}>
              <p><strong>Name:</strong> {selectedApplicant.applicant?.first_name} {selectedApplicant.applicant?.last_name}</p>
              <p><strong>Profile summary:</strong> {selectedApplicant.applicant?.about_me || 'No profile summary provided yet.'}</p>
              <p><strong>Application received:</strong> {selectedApplicant.appliedAt || 'Unknown'}</p>
              <p><strong>Current status:</strong> {getApplicationStatusLabel(selectedApplicant.status)}</p>
              {selectedApplicant.cvLink ? (
                <div style={{ marginTop: '0.5rem' }}>
                  {/\\.pdf$/i.test(selectedApplicant.cvLink) ? (
                    <div style={{ border: '1px solid rgba(172,208,255,0.15)', borderRadius: 8, overflow: 'hidden' }}>
                      <iframe
                        title="Applicant CV"
                        src={selectedApplicant.cvLink}
                        style={{ width: '100%', height: 420, border: 'none' }}
                      />
                    </div>
                  ) : (
                    <p><a href={selectedApplicant.cvLink} target="_blank" rel="noopener noreferrer">Open CV</a></p>
                  )}
                </div>
              ) : (
                <p>No CV uploaded</p>
              )}
              <div className="provider-application-status-row" style={{ marginTop: '0.8rem' }}>
                <label htmlFor={`modal-application-status-${selectedApplicant.id}`} className="provider-application-status-label">
                  Application status
                </label>
                <div className="provider-application-status-controls">
                  <select
                    id={`modal-application-status-${selectedApplicant.id}`}
                    value={selectedApplicant.statusDraft || selectedApplicant.status}
                    onChange={(event) => handleStatusDraftChange(selectedApplicant.id, event.target.value)}
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
                    disabled={updatingApplicationId === selectedApplicant.id || (selectedApplicant.statusDraft || selectedApplicant.status) === selectedApplicant.status}
                    onClick={() => handleStatusUpdate(selectedApplicant)}
                  >
                    {updatingApplicationId === selectedApplicant.id ? 'Updating...' : 'Update status'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

// Export helpers for unit testing
export {
  getApplicationStatusLabel,
  normalizeApplicationStatus,
  getApplicationStatusClass,
  formatRandAmount,
  formatShortDate,
}
