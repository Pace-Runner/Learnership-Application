import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'
import './UserPages.css'

const DOCS_BUCKET = 'applicant-documents'

function getStatusClass(status) {
  if (!status) return 'status-chip-soft'
  if (status === 'Pending') return 'status-chip-pending'
  if (status === 'Shortlisted' || status === 'Reviewed') return 'status-chip-reviewed'
  if (status === 'Offered' || status === 'Accepted') return 'status-chip-accepted'
  if (status === 'Rejected') return 'status-chip-rejected'
  return 'status-chip-soft'
}

export default function ProviderListingApplications() {
  const { listingId } = useParams()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [applications, setApplications] = useState([])
  const [listingTitle, setListingTitle] = useState('')
  const [selectedApplicant, setSelectedApplicant] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const loadApplications = useCallback(async () => {
    setIsLoading(true)
    setError('')

    if (!hasSupabaseConfig) {
      setError('Supabase not configured. Data unavailable in demo mode.')
      setIsLoading(false)
      return
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    const email = sessionData?.session?.user?.email

    if (sessionError || !email) {
      setError('You must be signed in as a Provider to view applicants.')
      setIsLoading(false)
      return
    }

    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (userError || !userRow?.id) {
      setError('Provider user record was not found.')
      setIsLoading(false)
      return
    }

    const { data: providerRow, error: providerError } = await supabase
      .from('provider_profiles')
      .select('id')
      .eq('user_id', userRow.id)
      .maybeSingle()

    if (providerError || !providerRow?.id) {
      setError('Provider profile was not found.')
      setIsLoading(false)
      return
    }

    // Verify the listing belongs to this provider and get title
    const { data: listingRow, error: listingError } = await supabase
      .from('opportunities')
      .select('id,title,provider_id')
      .eq('id', listingId)
      .maybeSingle()

    if (listingError || !listingRow || listingRow.provider_id !== providerRow.id) {
      setError('Listing not found or you do not have permission to view it.')
      setIsLoading(false)
      return
    }

    setListingTitle(listingRow.title || '')

    // Load applications joined with applicant profile fields and status
    const { data: appRows, error: appError } = await supabase
      .from('applications')
      .select('id,status,applied_at,applicant_profiles:applicant_id(first_name,last_name,about_me,cv_url,user_id)')
      .eq('opportunity_id', listingId)
      .order('applied_at', { ascending: false })

    if (appError) {
      setError('Could not load applications. Check RLS policies.')
      setIsLoading(false)
      return
    }

    const normalized = (appRows || []).map((row) => {
      return {
        id: row.id,
        status: row.status || '',
        appliedAt: row.applied_at,
        applicant: row.applicant_profiles || {},
      }
    })

    // Resolve signed URL for CV if available
    const withCvLinks = await Promise.all(
      normalized.map(async (item) => {
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

    setApplications(withCvLinks)
    setIsLoading(false)
  }, [listingId])

  useEffect(() => {
    let isMounted = true
    loadApplications()
    return () => {
      isMounted = false
    }
  }, [loadApplications])

  const handleUpdateStatus = async (appId, newStatus) => {
    if (!hasSupabaseConfig) return

    try {
      setIsLoading(true)
      const { error } = await supabase.from('applications').update({ status: newStatus }).eq('id', appId)
      if (error) {
        setError('Could not update application status. Check permissions.')
      } else {
        // refresh list
        await loadApplications()
      }
    } catch (e) {
      setError('Unexpected error updating status.')
    } finally {
      setIsLoading(false)
    }
  }

  const openApplicantModal = (app) => {
    setSelectedApplicant(app)
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
            <p className="user-intro">View all applicants who applied to this listing.</p>
          </section>

          <nav className="user-nav-actions" aria-label="Provider listing navigation">
            <Link to="/provider" className="user-link-btn">
              Back to Dashboard
            </Link>
          </nav>
        </header>

        <section className="user-panel provider-panel">
          <h2>{listingTitle ? `Applicants — ${listingTitle}` : 'Applicants'}</h2>

          {isLoading ? <p className="user-panel-copy">Loading applicants...</p> : null}
          {!isLoading && error ? <p className="user-panel-copy">{error}</p> : null}

          {!isLoading && !error ? (
            applications.length === 0 ? (
              <p className="user-panel-copy">No applications have been submitted yet.</p>
            ) : (
              <ul className="user-list provider-list">
                {applications.map((app) => (
                  <li key={app.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <strong>
                          {app.applicant?.first_name || 'Applicant'} {app.applicant?.last_name || ''}
                        </strong>
                        <p className="user-item-meta">{app.applicant?.about_me || 'No profile summary'}</p>
                        {app.cvLink ? (
                          <p>
                            <a href={app.cvLink} target="_blank" rel="noopener noreferrer">
                              Download CV
                            </a>
                          </p>
                        ) : (
                          <p className="user-item-meta">No CV uploaded</p>
                        )}
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span className={`status-chip ${getStatusClass(app.status)}`}>
                          {app.status || 'Pending'}
                        </span>
                        <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button className="user-action-btn" onClick={() => openApplicantModal(app)}>Details</button>
                          <button className="user-action-btn" onClick={() => handleUpdateStatus(app.id, 'Offered')}>Accept</button>
                          <button className="user-action-btn provider-delete-btn" onClick={() => handleUpdateStatus(app.id, 'Rejected')}>Reject</button>
                        </div>
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
              <p><strong>About:</strong> {selectedApplicant.applicant?.about_me || 'No profile summary'}</p>
              <p><strong>Applied:</strong> {selectedApplicant.appliedAt || 'Unknown'}</p>
              {selectedApplicant.cvLink ? (
                <p><a href={selectedApplicant.cvLink} target="_blank" rel="noopener noreferrer">Open CV</a></p>
              ) : (
                <p>No CV uploaded</p>
              )}
              <div style={{ marginTop: '0.8rem', display: 'flex', gap: '0.5rem' }}>
                <button className="user-action-btn" onClick={() => handleUpdateStatus(selectedApplicant.id, 'Offered')}>Accept</button>
                <button className="user-action-btn provider-delete-btn" onClick={() => handleUpdateStatus(selectedApplicant.id, 'Rejected')}>Reject</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
