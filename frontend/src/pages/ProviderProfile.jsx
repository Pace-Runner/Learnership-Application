import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'
import './UserPages.css'

const initialProfileForm = {
  organisation_name: '',
  phone: '',
  description: '',
}

function getFriendlySupabaseError(error, fallbackMessage) {
  if (!error) {
    return fallbackMessage
  }

  const code = error.code || ''
  const message = (error.message || '').toLowerCase()

  if (code === '42501' || message.includes('row-level security')) {
    return 'You do not have permission to access this provider profile yet. Please check the latest RLS policy.'
  }

  if (code === '23505' || message.includes('duplicate')) {
    return 'A provider profile already exists for this account. Please refresh and try again.'
  }

  if (code === '23503' || message.includes('foreign key')) {
    return 'Your provider account link is incomplete. Please sign out and sign in again.'
  }

  if (message.includes('failed to fetch') || message.includes('network')) {
    return 'Network error while saving your profile. Please check your connection and try again.'
  }

  return error.message || fallbackMessage
}

function validateProfile(values) {
  const nextErrors = {}

  if (!values.organisation_name.trim()) {
    nextErrors.organisation_name = 'Company / organisation name is required.'
  }

  if (!values.phone.trim()) {
    nextErrors.phone = 'Phone number is required.'
  } else if (!/^[+()0-9\s-]{7,20}$/.test(values.phone.trim())) {
    nextErrors.phone = 'Enter a valid phone number.'
  }

  if (!values.description.trim()) {
    nextErrors.description = 'Description is required.'
  }

  return nextErrors
}

function createSavedProfileSnapshot(profileValues) {
  return {
    organisation_name: profileValues.organisation_name.trim(),
    phone: profileValues.phone.trim(),
    description: profileValues.description.trim(),
  }
}

export default function ProviderProfile({ onLogout }) {
  const navigate = useNavigate()
  const [userId, setUserId] = useState('')
  const [profileId, setProfileId] = useState('')
  const [profileForm, setProfileForm] = useState(initialProfileForm)
  const [savedProfile, setSavedProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  const profileSummary = useMemo(() => {
    if (!savedProfile) {
      return {
        organisation_name: 'Profile not saved yet',
        phone: 'Not specified',
        description: 'Add your organisation details on the form to show them here.',
      }
    }

    return savedProfile
  }, [savedProfile])

  useEffect(() => {
    let isMounted = true

    const loadProviderProfile = async () => {
      setIsLoading(true)
      setLoadError('')

      if (!hasSupabaseConfig) {
        if (isMounted) {
          setLoadError('Supabase is not configured. Provider profiles cannot be loaded right now.')
          setIsLoading(false)
        }
        return
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      const email = sessionData?.session?.user?.email

      if (sessionError || !email) {
        if (isMounted) {
          setLoadError('You must be signed in as a Provider to edit your profile.')
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
          setLoadError('Provider account details were not found.')
          setIsLoading(false)
        }
        return
      }

      const { data: profileRow, error: profileError } = await supabase
        .from('provider_profiles')
        .select('id,organisation_name,phone,description,contact_email')
        .eq('user_id', userRow.id)
        .maybeSingle()

      if (profileError) {
        if (isMounted) {
          setLoadError(getFriendlySupabaseError(profileError, 'Provider profile could not be loaded.'))
          setIsLoading(false)
        }
        return
      }

      if (isMounted) {
        setUserId(userRow.id)
        setProfileId(profileRow?.id || '')
        const nextValues = {
          organisation_name: profileRow?.organisation_name || '',
          phone: profileRow?.phone || '',
          description: profileRow?.description || '',
        }
        setProfileForm(nextValues)
        setSavedProfile(profileRow ? createSavedProfileSnapshot(nextValues) : null)
        setIsLoading(false)
      }
    }

    loadProviderProfile()

    return () => {
      isMounted = false
    }
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target

    setProfileForm((current) => ({
      ...current,
      [name]: value,
    }))

    setFieldErrors((current) => {
      if (!current[name]) {
        return current
      }

      const updated = { ...current }
      delete updated[name]
      return updated
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaveMessage('')

    const nextErrors = validateProfile(profileForm)
    setFieldErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    if (!hasSupabaseConfig) {
      setSaveMessage('Supabase is not configured. Provider profiles cannot be saved yet.')
      return
    }

    setIsSaving(true)

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    const email = sessionData?.session?.user?.email

    if (sessionError || !email) {
      setIsSaving(false)
      setSaveMessage('You must be signed in as a Provider to save your profile. It does not seem like you are signed in.')
      return
    }

    let resolvedUserId = userId

    if (!resolvedUserId) {
      const { data: userRow, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      if (userError || !userRow?.id) {
        setIsSaving(false)
        setSaveMessage('Provider account details were not found.')
        return
      }

      resolvedUserId = userRow.id
      setUserId(resolvedUserId)
    }

    const payload = {
      user_id: resolvedUserId,
      organisation_name: profileForm.organisation_name.trim(),
      phone: profileForm.phone.trim(),
      description: profileForm.description.trim(),
      contact_email: email,
    }

    if (profileId) {
      const { error: updateError } = await supabase
        .from('provider_profiles')
        .update(payload)
        .eq('id', profileId)

      if (updateError) {
        setIsSaving(false)
        setSaveMessage(getFriendlySupabaseError(updateError, 'Provider profile could not be saved.'))
        return
      }
    } else {
      const { data: insertedProfile, error: insertError } = await supabase
        .from('provider_profiles')
        .insert(payload)
        .select('id')
        .single()

      if (insertError || !insertedProfile?.id) {
        setIsSaving(false)
        setSaveMessage(getFriendlySupabaseError(insertError, 'Provider profile could not be saved.'))
        return
      }

      setProfileId(insertedProfile.id)
    }

    const nextSavedProfile = createSavedProfileSnapshot(profileForm)
    setSavedProfile(nextSavedProfile)
    setSaveMessage('Provider profile saved successfully.')
    setIsSaving(false)
    navigate('/provider', { replace: true })
  }

  return (
    <main className="user-page provider-theme profile-shell">
      <section className="user-page-inner">
        <header className="user-hero profile-header">
          <section>
            <p className="user-kicker">Provider Profile</p>
            <h1>Tell applicants who they will work with</h1>
            <p className="user-intro">
              Save your phone number, company or organisation name, and a short description so your
              opportunities feel trustworthy and clear.
            </p>
            {saveMessage ? <p className="user-item-meta">{saveMessage}</p> : null}
            {loadError ? <p className="user-item-meta">{loadError}</p> : null}
            {isLoading ? <p className="user-item-meta">Loading your provider profile...</p> : null}
          </section>

          <nav className="user-nav-actions" aria-label="Profile actions">
            <button type="button" className="user-link-btn" onClick={() => navigate('/provider')}>
              Back to workspace
            </button>
            <button onClick={onLogout} className="user-logout-btn">
              Logout
            </button>
          </nav>
        </header>

        <section className="profile-overview-grid">
          <article className="user-panel profile-card profile-card-personal">
            <h2>Profile form</h2>

            <form onSubmit={handleSubmit} className="profile-fields-grid" noValidate>
              <label
                className={`profile-field ${fieldErrors.organisation_name ? 'profile-field-invalid' : ''}`}
                htmlFor="provider-organisation-name"
              >
                <span>Company / organisation name</span>
                <input
                  className="profile-input"
                  id="provider-organisation-name"
                  name="organisation_name"
                  value={profileForm.organisation_name}
                  onChange={handleChange}
                  aria-invalid={Boolean(fieldErrors.organisation_name)}
                />
                {fieldErrors.organisation_name ? (
                  <p className="profile-field-error">{fieldErrors.organisation_name}</p>
                ) : null}
              </label>

              <label className={`profile-field ${fieldErrors.phone ? 'profile-field-invalid' : ''}`} htmlFor="provider-phone">
                <span>Phone number</span>
                <input
                  className="profile-input"
                  id="provider-phone"
                  name="phone"
                  inputMode="tel"
                  maxLength={20}
                  placeholder="e.g. 0821234567"
                  value={profileForm.phone}
                  onChange={handleChange}
                  aria-invalid={Boolean(fieldErrors.phone)}
                />
                {fieldErrors.phone ? <p className="profile-field-error">{fieldErrors.phone}</p> : null}
              </label>

              <label
                className={`profile-field ${fieldErrors.description ? 'profile-field-invalid' : ''}`}
                htmlFor="provider-description"
              >
                <span>Description</span>
                <textarea
                  className="profile-input"
                  id="provider-description"
                  name="description"
                  rows={6}
                  placeholder="Describe your organisation, what you offer, and what applicants can expect."
                  value={profileForm.description}
                  onChange={handleChange}
                  aria-invalid={Boolean(fieldErrors.description)}
                />
                {fieldErrors.description ? (
                  <p className="profile-field-error">{fieldErrors.description}</p>
                ) : null}
              </label>

              <button type="submit" className="user-action-btn provider-inline-btn" disabled={isSaving}>
                {isSaving ? 'Saving profile...' : 'Save provider profile'}
              </button>
            </form>
          </article>

          <article className="user-panel profile-card">
            <h2>Saved profile</h2>
            <p className="user-item-meta">
              This is the information applicants will see on your provider profile page.
            </p>

            <div className="provider-profile-summary">
              <p className="provider-profile-summary-label">Company / organisation name</p>
              <strong>{profileSummary.organisation_name}</strong>

              <p className="provider-profile-summary-label">Phone number</p>
              <strong>{profileSummary.phone}</strong>

              <p className="provider-profile-summary-label">Description</p>
              <p className="provider-profile-summary-copy">{profileSummary.description}</p>
            </div>

            <Link to="/provider" className="user-link-btn provider-inline-btn">
              View provider workspace
            </Link>
          </article>
        </section>
      </section>
    </main>
  )
}