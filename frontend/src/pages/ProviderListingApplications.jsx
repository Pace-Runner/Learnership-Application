import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'
import './UserPages.css'

const DOCS_BUCKET = 'applicant-documents'

export default function ProviderListingApplications() {
  const { listingId } = useParams()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [applications, setApplications] = useState([])
  const [listingTitle, setListingTitle] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadApplications = async () => {
      setIsLoading(true)
      setError('')

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

      // Verify the listing belongs to this provider and get title
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

      if (isMounted) setListingTitle(listingRow.title || '')

      // Load applications joined with applicant profile fields
      const { data: appRows, error: appError } = await supabase
        .from('applications')
        .select('id,applied_at,applicant_profiles:applicant_id(first_name,last_name,about_me,cv_url)')
        .eq('opportunity_id', listingId)
        .order('applied_at', { ascending: false })

      if (appError) {
        if (isMounted) {
          setError('Could not load applications. Check RLS policies.')
          setIsLoading(false)
        }
        return
      }

      const normalized = (appRows || []).map((row) => {
        return {
          id: row.id,
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
          } catch (e) {
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
  }, [listingId, navigate])

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
