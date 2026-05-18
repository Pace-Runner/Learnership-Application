/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'
import './UserPages.css'

const PROFILE_BUCKET = 'profile-images'
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

function formatDocumentLabel(fileName) {
  if (!fileName) {
    return 'Document'
  }

  const withoutTimestamp = fileName.replace(/^\d{8,}-/, '')
  if (/-cv-/i.test(withoutTimestamp)) {
    return 'CV'
  }

  return withoutTimestamp.replace(/^cv-/i, '').replace(/[_-]+/g, ' ').replace(/\.[^.]+$/, '')
}

function getApplicantInitials(applicant) {
  const firstInitial = applicant?.first_name?.trim()?.charAt(0) || ''
  const lastInitial = applicant?.last_name?.trim()?.charAt(0) || ''
  const value = `${firstInitial}${lastInitial}`.toUpperCase()

  return value || 'AP'
}

async function resolveStorageLink(bucket, path) {
  if (!path) {
    return ''
  }

  if (/^https?:\/\//i.test(path)) {
    return path
  }

  try {
    const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10)
    if (signed?.data?.signedUrl) {
      return signed.data.signedUrl
    }

    if (signed?.error && ((signed.error.message || '').toLowerCase().includes('bucket not found') || signed.error.status === 404)) {
      if (bucket.includes('/')) {
        const [rootBucket, ...rest] = bucket.split('/')
        const prefix = rest.join('/')
        const altPath = prefix ? `${prefix}/${path}` : path
        const altSigned = await supabase.storage.from(rootBucket).createSignedUrl(altPath, 60 * 10)
        if (altSigned?.data?.signedUrl) {
          return altSigned.data.signedUrl
        }

        const altPublic = await supabase.storage.from(rootBucket).getPublicUrl(altPath)
        return altPublic?.data?.publicUrl || ''
      }
    }

    const publicResult = await supabase.storage.from(bucket).getPublicUrl(path)
    return publicResult?.data?.publicUrl || ''
  } catch (err) {
    console.debug('resolveStorageLink createSignedUrl error', err)
    try {
      const publicResult = await supabase.storage.from(bucket).getPublicUrl(path)
      if (publicResult?.data?.publicUrl) {
        return publicResult.data.publicUrl
      }
    } catch (publicError) {
      console.debug('resolveStorageLink getPublicUrl error', publicError)
    }

    return ''
  }
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
  const [isModalLoading, setIsModalLoading] = useState(false)
  const [updatingApplicationId, setUpdatingApplicationId] = useState('')
  const modalRequestRef = useRef(0)

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
        .select('id,applicant_id,status,applied_at,applicant_profiles:applicant_id(user_id,first_name,last_name,phone,location,date_of_birth,about_me,cv_url,profile_image_url)')
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
          const cvLink = await resolveStorageLink(DOCS_BUCKET, normalizedPath)
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

  const loadApplicantDetails = async (application) => {
    const applicant = application.applicant || {}
    const applicantId = application.applicantId || application.applicant_id || ''
    const authUserId = applicant.user_id || ''

    const [educationResult, skillLinksResult, profileImageListResult, docsListResult] = await Promise.all([
      applicantId
        ? supabase
            .from('applicant_education')
            .select('institution,qualification_id,nqf_level,year_completed,qualification:nqf_qualifications(title,saqa_id)')
            .eq('applicant_id', applicantId)
            .order('year_completed', { ascending: false })
        : Promise.resolve({ data: [] }),
      applicantId
        ? supabase.from('applicant_skills').select('skill_tag_id,skill_tags:skill_tag_id(id,name)').eq('applicant_id', applicantId)
        : Promise.resolve({ data: [] }),
      authUserId
        ? supabase.storage.from(PROFILE_BUCKET).list(authUserId, { limit: 10 })
        : Promise.resolve({ data: [] }),
      authUserId
        ? supabase.storage.from(DOCS_BUCKET).list(authUserId, { limit: 100 })
        : Promise.resolve({ data: [] }),
    ])

    // Log any storage list errors to aid debugging when files are not returned.
    if (profileImageListResult?.error) {
      console.debug('profile image list error', profileImageListResult.error)
    }

    if (docsListResult?.error) {
      console.debug('documents list error', docsListResult.error)
    }

    // Prefer a stored public URL on the applicant profile (saved at upload time)
    let profileImageUrl = applicant?.profile_image_url || ''
    if (!profileImageUrl) {
      const profileFiles = (profileImageListResult?.data || []).filter((file) => file?.name && !file.name.endsWith('/'))
      const firstProfileFile = profileFiles[0]
      if (firstProfileFile?.name) {
        profileImageUrl = await resolveStorageLink(PROFILE_BUCKET, `${authUserId}/${firstProfileFile.name}`)
      } else {
        // Fallback: try common profile filenames when list() returns empty (RLS may prevent listing).
        const commonProfileNames = ['profile.jpg', 'profile.jpeg', 'profile.png', 'profile.webp']
        for (const name of commonProfileNames) {
          const candidate = await resolveStorageLink(PROFILE_BUCKET, `${authUserId}/${name}`)
          if (candidate) {
            profileImageUrl = candidate
            break
          }
        }
      }
    }

    const education = (educationResult?.data || []).map((row) => ({
      institution: row.institution || '',
      qualificationTitle: row.qualification?.title || '',
      qualificationId: row.qualification_id || '',
      nqfLevel: row.nqf_level || '',
      yearCompleted: row.year_completed || '',
    }))

    const skillRecords = (skillLinksResult?.data || [])
      .map((row) => row.skill_tags || null)
      .filter(Boolean)
    const skillNames = [...new Map(skillRecords.map((skill) => [skill.id, skill.name])).values()]

    const allDocs = (docsListResult?.data || [])
      .filter((file) => file?.name && !file.name.endsWith('/'))
      .map((file) => ({
        name: file.name,
        label: formatDocumentLabel(file.name),
        url: '',
      }))

    // If storage.list returned no documents, try falling back to the CV path stored on the profile
    if (allDocs.length === 0 && (application.applicant?.cv_url || application.cvLink)) {
      const storedCv = application.applicant?.cv_url || application.cvLink
      let normalizedPath = storedCv.includes('/') ? storedCv : authUserId ? `${authUserId}/${storedCv}` : storedCv
      const fallbackUrl = await resolveStorageLink(DOCS_BUCKET, normalizedPath)
      if (fallbackUrl) {
        allDocs.push({ name: storedCv, label: formatDocumentLabel(storedCv), url: fallbackUrl })
      }
    }

    const documentEntries = await Promise.all(
      allDocs.map(async (doc) => ({
        ...doc,
        url: doc.url || (await resolveStorageLink(DOCS_BUCKET, `${authUserId}/${doc.name}`)),
      })),
    )

    // Keep all uploaded documents available to the provider view. Treat the first document as a fallback cvLink.
    return {
      ...application,
      applicant: {
        ...applicant,
        skills: skillNames,
        education,
        profileImageUrl,
        documentEntries,
      },
      cvLink: application.cvLink || (documentEntries[0]?.url || ''),
    }
  }

  const openApplicantModal = async (application) => {
    const requestId = modalRequestRef.current + 1
    modalRequestRef.current = requestId

    setSelectedApplicant(application)
    setIsModalOpen(true)
    setIsModalLoading(true)

    try {
      const enrichedApplicant = await loadApplicantDetails(application)
      if (modalRequestRef.current === requestId) {
        setSelectedApplicant(enrichedApplicant)
      }
    } catch (loadError) {
      console.debug('Applicant details enrichment failed', loadError)
    } finally {
      if (modalRequestRef.current === requestId) {
        setIsModalLoading(false)
      }
    }
  }

  const closeApplicantModal = () => {
    modalRequestRef.current += 1
    setSelectedApplicant(null)
    setIsModalOpen(false)
    setIsModalLoading(false)
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
                    {application.appliedAt ? (
                      <small className="user-item-meta">
                        Applied: {new Date(application.appliedAt).toLocaleDateString()}
                      </small>
                    ) : null}
                    <small className="user-item-meta">
                      Location: {application.applicant?.location || 'Not specified'}
                    </small>
                    <p className="user-item-meta">{application.applicant?.about_me || 'No profile summary provided yet.'}</p>
                    <small className="user-item-meta">
                      Current status: {getApplicationStatusLabel(application.status)}
                    </small>
                    {application.cvLink ? (
                      <p className="user-item-meta">
                        <a href={application.cvLink} target="_blank" rel="noopener noreferrer">
                          Download CV
                        </a>
                      </p>
                    ) : null}
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
        <div className="modal-backdrop">
          <div className="applicant-detail-modal user-panel">
            <header className="applicant-detail-modal-header">
              <div>
                <p className="provider-panel-kicker">Applicant profile</p>
                <h3>Applicant details</h3>
              </div>
              <button className="user-link-btn" onClick={closeApplicantModal}>Close</button>
            </header>

            {isModalLoading ? (
              <p className="user-panel-copy">Loading applicant profile details...</p>
            ) : null}

            <section className="applicant-hero-card">
              <div className="applicant-profile-photo">
                {selectedApplicant.applicant?.profileImageUrl ? (
                  <img src={selectedApplicant.applicant.profileImageUrl} alt="Applicant profile" />
                ) : (
                  <span>{getApplicantInitials(selectedApplicant.applicant)}</span>
                )}
              </div>

              <div className="applicant-hero-copy">
                <p className="applicant-hero-label">Name</p>
                <h4>
                  {selectedApplicant.applicant?.first_name || 'Applicant'} {selectedApplicant.applicant?.last_name || ''}
                </h4>
                <p className="applicant-hero-summary">
                  {selectedApplicant.applicant?.about_me || 'No profile summary provided yet.'}
                </p>
                <div className="applicant-hero-meta">
                  <span>Application received: {formatShortDate(selectedApplicant.appliedAt)}</span>
                </div>
              </div>
            </section>

            <section className="applicant-detail-grid">
              <article className="applicant-detail-card">
                <h5>Contact details</h5>
                <p><strong>Location:</strong> {selectedApplicant.applicant?.location || 'Not specified'}</p>
                <p><strong>Phone number:</strong> {selectedApplicant.applicant?.phone || 'Not specified'}</p>
                <p><strong>Date of birth:</strong> {formatShortDate(selectedApplicant.applicant?.date_of_birth)}</p>
              </article>

              <article className="applicant-detail-card">
                <h5>Education</h5>
                {selectedApplicant.applicant?.education?.length ? (
                  <ul className="applicant-info-list">
                    {selectedApplicant.applicant.education.map((educationItem, index) => (
                      <li key={`${educationItem.institution || 'education'}-${index}`}>
                        <strong>{educationItem.institution || 'Institution not specified'}</strong>
                        <span>
                          {educationItem.qualificationTitle || 'Qualification not specified'}
                          {educationItem.nqfLevel ? ` · NQF ${educationItem.nqfLevel}` : ''}
                          {educationItem.yearCompleted ? ` · ${educationItem.yearCompleted}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="user-item-meta">No education details were found.</p>
                )}
              </article>

              <article className="applicant-detail-card applicant-detail-card-wide">
                <h5>Skills</h5>
                {selectedApplicant.applicant?.skills?.length ? (
                  <div className="skill-pill-group skill-pill-group-selected applicant-skill-pill-group">
                    {selectedApplicant.applicant.skills.map((skill) => (
                      <span key={skill} className="skill-pill skill-pill-active">{skill}</span>
                    ))}
                  </div>
                ) : (
                  <p className="user-item-meta">No skills were found for this applicant.</p>
                )}
              </article>

              <article className="applicant-detail-card applicant-detail-card-wide">
                <h5>Documents</h5>
                {(() => {
                  const existing = selectedApplicant.applicant?.documentEntries || []
                  const docs = [...existing]
                  if (selectedApplicant.cvLink && !docs.find((d) => d.url === selectedApplicant.cvLink)) {
                    docs.unshift({ name: 'cv-fallback', label: 'CV', url: selectedApplicant.cvLink })
                  }

                  return docs.length ? (
                    <ul className="applicant-doc-list">
                      {docs.map((doc) => (
                        <li key={doc.name}>
                          {doc.url ? (
                            <a href={doc.url} target="_blank" rel="noopener noreferrer">
                              { /cv/i.test(doc.name) ? 'Open CV' : `Open ${doc.label}` }
                            </a>
                          ) : (
                            <span>{doc.label}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="user-item-meta">No documents uploaded.</p>
                  )
                })()}
              </article>
            </section>

            <div className="provider-application-status-row applicant-modal-status-row">
              <label htmlFor={`modal-application-status-${selectedApplicant.id}`} className="provider-application-status-label">
                Application status
              </label>
              <div className="provider-application-status-controls applicant-modal-status-controls">
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
