import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'
import './UserPages.css'

const initialProfileForm = {
  organisation_name: '',
  phone: '',
  description: '',
  logo_file: null,
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

function SkeletonFormFields() {
  return (
    <>
      <div className="profile-form-group logo-upload-group">
        <label>
          <span>Company logo (optional)</span>
        </label>
        <div className="logo-upload-container">
          <div className="skeleton-loader skeleton-preview-logo" />
          <div className="skeleton-loader skeleton-input" style={{ height: '2.25rem' }} />
        </div>
      </div>

      <div className="profile-form-group">
        <div className="profile-field">
          <span>Company / organisation name *</span>
          <div className="skeleton-loader skeleton-input" />
        </div>
      </div>

      <div className="profile-form-group">
        <div className="profile-field">
          <span>Phone number *</span>
          <div className="skeleton-loader skeleton-input" />
        </div>
      </div>

      <div className="profile-form-group description-group">
        <div className="profile-field">
          <span>About your organisation *</span>
          <div className="skeleton-loader skeleton-textarea" />
        </div>
      </div>
    </>
  )
}

function SkeletonPreviewContent() {
  return (
    <>
      <div className="skeleton-loader skeleton-preview-logo" />
      
      <div className="skeleton-preview-field">
        <div className="skeleton-loader skeleton-preview-field-label" />
        <div className="skeleton-loader skeleton-preview-field-value" />
      </div>

      <div className="skeleton-preview-field">
        <div className="skeleton-loader skeleton-preview-field-label" />
        <div className="skeleton-loader skeleton-preview-field-value" />
      </div>

      <div className="skeleton-preview-field">
        <div className="skeleton-loader skeleton-preview-field-label" />
        <div className="skeleton-loader skeleton-preview-field-value" />
      </div>
    </>
  )
}

function createSavedProfileSnapshot(profileValues) {
  return {
    organisation_name: profileValues.organisation_name.trim(),
    phone: profileValues.phone.trim(),
    description: profileValues.description.trim(),
  }
}

export default function ProviderProfile({ onLogout, onProfileSaved }) {
  const navigate = useNavigate()
  const [userId, setUserId] = useState('')
  const [profileId, setProfileId] = useState('')
  const [profileForm, setProfileForm] = useState(initialProfileForm)
  const [logoUrl, setLogoUrl] = useState('')
  const [logoPreview, setLogoPreview] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

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
        .select('id,organisation_name,phone,description,contact_email,logo_url')
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
        if (profileRow?.logo_url) {
          setLogoUrl(profileRow.logo_url)
        }
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

  const handleLogoChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setProfileForm((current) => ({
      ...current,
      logo_file: file,
    }))

    const reader = new FileReader()
    reader.onload = (e) => {
      setLogoPreview(e.target?.result || '')
    }
    reader.readAsDataURL(file)
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
    let persistedLogoUrl = logoUrl

    // Upload logo if a new file was selected
    if (profileForm.logo_file) {
      const logoFileName = `${resolvedUserId}-${Date.now()}-${profileForm.logo_file.name}`
      
      // Create a timeout promise (30 seconds)
      const uploadTimeout = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Logo upload took too long. Saving profile without logo.'))
        }, 30000)
      })

      try {
        // Race between upload and timeout
        const uploadResult = await Promise.race([
          supabase.storage
            .from('provider_logos')
            .upload(logoFileName, profileForm.logo_file, { upsert: true }),
          uploadTimeout,
        ])

        if (uploadResult?.error) {
          throw uploadResult.error
        }

        const { data: publicUrlData } = supabase.storage
          .from('provider_logos')
          .getPublicUrl(logoFileName)
        const logoPublicUrl = publicUrlData.publicUrl
        setLogoUrl(logoPublicUrl)
        persistedLogoUrl = logoPublicUrl
      } catch (uploadError) {
        // Logo upload failed but continue saving profile
        console.warn('Logo upload failed:', uploadError)
        persistedLogoUrl = logoPreview || persistedLogoUrl
      }
    }

    if (persistedLogoUrl) {
      payload.logo_url = persistedLogoUrl
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
    setSaveMessage('Provider profile saved successfully.')
    setIsSaving(false)
    if (onProfileSaved) {
      onProfileSaved(nextSavedProfile)
    }
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

        <section className="profile-content-section">
          <article className="user-panel profile-form-card">
            <h2>Build your profile</h2>
            <p className="profile-form-intro">Add your company details so applicants know who they're working with.</p>

            {loadError ? <p className="user-panel-copy error">{loadError}</p> : null}

            {isLoading ? (
              <form className="profile-form-layout" noValidate>
                <SkeletonFormFields />
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="profile-form-layout" noValidate>
                <div className="profile-form-group logo-upload-group">
                  <label htmlFor="provider-logo">
                    <span>Company logo (optional)</span>
                  </label>
                  <div className="logo-upload-container">
                    {(logoPreview || logoUrl) && (
                      <div className="logo-preview">
                        <img src={logoPreview || logoUrl} alt="Company logo preview" />
                      </div>
                    )}
                    <input
                      type="file"
                      id="provider-logo"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="profile-file-input"
                    />
                  </div>
                </div>

                <div className="profile-form-group">
                  <label className={`profile-field ${fieldErrors.organisation_name ? 'profile-field-invalid' : ''}`} htmlFor="provider-organisation-name">
                    <span>Company / organisation name *</span>
                    <input
                      className="profile-input"
                      id="provider-organisation-name"
                      name="organisation_name"
                      value={profileForm.organisation_name}
                      onChange={handleChange}
                      placeholder="e.g. Skills Hub Africa"
                      aria-invalid={Boolean(fieldErrors.organisation_name)}
                    />
                    {fieldErrors.organisation_name ? (
                      <p className="profile-field-error">{fieldErrors.organisation_name}</p>
                    ) : null}
                  </label>
                </div>

                <div className="profile-form-group">
                  <label className={`profile-field ${fieldErrors.phone ? 'profile-field-invalid' : ''}`} htmlFor="provider-phone">
                    <span>Phone number *</span>
                    <input
                      className="profile-input"
                      id="provider-phone"
                      name="phone"
                      inputMode="tel"
                      maxLength={20}
                      placeholder="e.g. +27 21 555 1000"
                      value={profileForm.phone}
                      onChange={handleChange}
                      aria-invalid={Boolean(fieldErrors.phone)}
                    />
                    {fieldErrors.phone ? <p className="profile-field-error">{fieldErrors.phone}</p> : null}
                  </label>
                </div>

                <div className="profile-form-group description-group">
                  <label className={`profile-field ${fieldErrors.description ? 'profile-field-invalid' : ''}`} htmlFor="provider-description">
                    <span>About your organisation *</span>
                    <textarea
                      className="profile-input profile-textarea"
                      id="provider-description"
                      name="description"
                      placeholder="Describe your organisation, what you offer learners, and what they can expect from the experience."
                      value={profileForm.description}
                      onChange={handleChange}
                      aria-invalid={Boolean(fieldErrors.description)}
                    />
                    {fieldErrors.description ? (
                      <p className="profile-field-error">{fieldErrors.description}</p>
                    ) : null}
                  </label>
                </div>

                <div className="profile-form-actions">
                  <button type="submit" className="user-action-btn provider-submit-btn" disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save profile'}
                  </button>
                  {saveMessage ? <p className="profile-save-message">{saveMessage}</p> : null}
                </div>
              </form>
            )}
          </article>

          <article className="user-panel profile-preview-card">
            <h2>Profile preview</h2>
            <p className="profile-form-intro">This is how applicants will see your profile.</p>

            <div className="profile-preview-content">
              {isLoading ? (
                <SkeletonPreviewContent />
              ) : (
                <>
                  {(logoPreview || logoUrl) && (
                    <div className="preview-logo">
                      <img src={logoPreview || logoUrl} alt="Company logo" />
                    </div>
                  )}
                  
                  <div className="preview-field">
                    <p className="preview-label">Organisation</p>
                    <p className="preview-value">{profileForm.organisation_name || 'Not added yet'}</p>
                  </div>

                  <div className="preview-field">
                    <p className="preview-label">Contact</p>
                    <p className="preview-value">{profileForm.phone || 'Not added yet'}</p>
                  </div>

                  <div className="preview-field">
                    <p className="preview-label">About us</p>
                    <p className="preview-value">{profileForm.description || 'Not added yet'}</p>
                  </div>
                </>
              )}
            </div>
          </article>
        </section>
      </section>
    </main>
  )
}