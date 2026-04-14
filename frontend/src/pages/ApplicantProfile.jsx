// APPLICANT PROFILE: User profile management page
// PURPOSE: Allow applicants to upload documents, manage profile info
// STATUS: Connected to Supabase Storage for profile pictures and documents

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'
import './UserPages.css'

const PROFILE_BUCKET = 'profile-images'
const DOCS_BUCKET = 'applicant-documents'

// Applicant profile page component
export default function ApplicantProfile({ onLogout }) {
  const [userId, setUserId] = useState('')
  const [profileImageUrl, setProfileImageUrl] = useState('')
  const [profileImageName, setProfileImageName] = useState('')
  const [aboutMe, setAboutMe] = useState('Ambitious entry-level candidate interested in business administration and digital operations roles.')
  const [uploadedDocs, setUploadedDocs] = useState([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(true)
  const [uploadMessage, setUploadMessage] = useState('')

  const profileInputRef = useRef(null)
  const cvInputRef = useRef(null)
  const docsInputRef = useRef(null)

  const ensureUploadReady = () => {
    if (!hasSupabaseConfig) {
      setUploadMessage('Uploads are disabled until Supabase env vars are configured.')
      return false
    }

    if (!userId) {
      setUploadMessage('Please sign in first. Uploads are only available for authenticated users.')
      return false
    }

    return true
  }

  const fetchFiles = async (authUserId) => {
    if (!authUserId || !hasSupabaseConfig) {
      setIsLoadingFiles(false)
      return
    }

    setIsLoadingFiles(true)

    // Load profile data including about_me from database
    const { data: profileData } = await supabase
      .from('applicant_profiles')
      .select('about_me')
      .eq('user_id', authUserId)
      .single()

    if (profileData?.about_me) {
      setAboutMe(profileData.about_me)
    }

    const [{ data: profileFiles }, { data: docFiles }] = await Promise.all([
      supabase.storage.from(PROFILE_BUCKET).list(authUserId, { limit: 10 }),
      supabase.storage.from(DOCS_BUCKET).list(authUserId, { limit: 100 }),
    ])

    const firstProfileFile = profileFiles?.[0]
    if (firstProfileFile?.name) {
      const { data } = await supabase.storage
        .from(PROFILE_BUCKET)
        .createSignedUrl(`${authUserId}/${firstProfileFile.name}`, 60 * 60)
      setProfileImageUrl(data?.signedUrl || '')
      setProfileImageName(firstProfileFile.name)
    } else {
      setProfileImageUrl('')
      setProfileImageName('')
    }

    setUploadedDocs(
      (docFiles || [])
        .filter((file) => file.name && !file.name.endsWith('/'))
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    )
    setIsLoadingFiles(false)
  }

  useEffect(() => {
    let isMounted = true

    const loadUserFiles = async () => {
      if (!hasSupabaseConfig) {
        if (isMounted) {
          setIsLoadingFiles(false)
          setUploadMessage('Supabase is not configured yet. Add env vars to enable uploads.')
        }
        return
      }

      const { data } = await supabase.auth.getUser()
      const authUserId = data?.user?.id || ''

      if (!isMounted) return

      setUserId(authUserId)
      await fetchFiles(authUserId)
    }

    loadUserFiles()

    return () => {
      isMounted = false
    }
  }, [])

  const handleProfileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !userId) return

    setUploadMessage('Uploading profile picture...')

    const extension = file.name.split('.').pop() || 'jpg'
    const filePath = `${userId}/profile.${extension}`

    const { error } = await supabase.storage
      .from(PROFILE_BUCKET)
      .upload(filePath, file, { upsert: true })

    if (error) {
      setUploadMessage('Profile upload failed. Please try again.')
      setTimeout(() => setUploadMessage(''), 3000)
      return
    }

    setUploadMessage('Profile picture uploaded successfully.')
    setTimeout(() => setUploadMessage(''), 3000)
    await fetchFiles(userId)
  }

  const handleDocumentUpload = async (event) => {
    const files = Array.from(event.target.files || [])
    if (!files.length || !userId) return

    setUploadMessage(`Uploading ${files.length} document${files.length > 1 ? 's' : ''}...`)

    for (const file of files) {
      const safeName = file.name.replace(/\s+/g, '_')
      const filePath = `${userId}/${Date.now()}-${safeName}`

      const { error } = await supabase.storage
        .from(DOCS_BUCKET)
        .upload(filePath, file, { upsert: false })

      if (error) {
        setUploadMessage(`Document upload failed for ${file.name}. Please try again.`)
        setTimeout(() => setUploadMessage(''), 3000)
        event.target.value = ''
        return
      }
    }

    event.target.value = ''
    setUploadMessage('Document(s) uploaded successfully.')
    setTimeout(() => setUploadMessage(''), 3000)
    await fetchFiles(userId)
  }

  const handleCvUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !userId) return

    setUploadMessage('Uploading CV...')

    const safeName = file.name.replace(/\s+/g, '_')
    const filePath = `${userId}/${Date.now()}-cv-${safeName}`

    const { error } = await supabase.storage
      .from(DOCS_BUCKET)
      .upload(filePath, file, { upsert: false })

    event.target.value = ''

    if (error) {
      setUploadMessage('CV upload failed. Please try again.')
      setTimeout(() => setUploadMessage(''), 3000)
      return
    }

    setUploadMessage('CV uploaded successfully.')
    setTimeout(() => setUploadMessage(''), 3000)
    await fetchFiles(userId)
  }

  const handleDeleteDocument = async (fileName) => {
    if (!userId || !fileName) return

    setUploadMessage('Deleting document...')

    const { error } = await supabase.storage
      .from(DOCS_BUCKET)
      .remove([`${userId}/${fileName}`])

    if (error) {
      setUploadMessage('Could not delete this document right now.')
      setTimeout(() => setUploadMessage(''), 3000)
      return
    }

    // Deleting from storage also removes the storage.objects row in Supabase metadata
    setUploadMessage('Document deleted.')
    setTimeout(() => setUploadMessage(''), 3000)
    await fetchFiles(userId)
  }

  const handleDeleteProfilePicture = async () => {
    if (!userId || !profileImageName) return

    setUploadMessage('Deleting profile picture...')

    const { error } = await supabase.storage
      .from(PROFILE_BUCKET)
      .remove([`${userId}/${profileImageName}`])

    if (error) {
      setUploadMessage('Could not delete profile picture right now.')
      setTimeout(() => setUploadMessage(''), 3000)
      return
    }

    // Deleting from storage also removes the storage.objects row in Supabase metadata
    setUploadMessage('Profile picture deleted.')
    setTimeout(() => setUploadMessage(''), 3000)
    await fetchFiles(userId)
  }

  const openDocument = async (fileName) => {
    if (!userId || !fileName) return

    const { data, error } = await supabase.storage
      .from(DOCS_BUCKET)
      .createSignedUrl(`${userId}/${fileName}`, 60 * 10)

    if (error || !data?.signedUrl) {
      setUploadMessage('Could not open document right now.')
      return
    }

    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const handleAboutSave = async () => {
    if (!userId || !aboutMe.trim()) {
      setUploadMessage('Please enter a description before saving.')
      setTimeout(() => setUploadMessage(''), 3000)
      return
    }

    setUploadMessage('Saving profile description...')

    // Check if profile exists
    const { data: existingProfile, error: selectError } = await supabase
      .from('applicant_profiles')
      .select('id')
      .eq('user_id', userId)
      .single()

    let error
    if (selectError && selectError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is expected for new users
      error = selectError
    } else if (existingProfile) {
      // Update existing profile
      const { error: updateError } = await supabase
        .from('applicant_profiles')
        .update({ about_me: aboutMe })
        .eq('user_id', userId)
      error = updateError
    } else {
      // Create new profile
      const { error: insertError } = await supabase
        .from('applicant_profiles')
        .insert({ user_id: userId, about_me: aboutMe })
      error = insertError
    }

    if (error) {
      setUploadMessage('Could not save description. Please try again.')
      setTimeout(() => setUploadMessage(''), 3000)
      return
    }

    setUploadMessage('Profile description saved successfully.')
    setTimeout(() => setUploadMessage(''), 3000)
  }

  return (
    <main className="user-page applicant-theme profile-shell">
      <section className="user-page-inner">
      <header className="user-hero profile-header">
        <section>
          <p className="user-kicker">Applicant Profile</p>
          <h1>Profile and documents</h1>
          {uploadMessage ? <p className="user-item-meta">{uploadMessage}</p> : null}
          <p className="user-intro">
            Keep your profile complete so applications are easier to review by employers and training providers.
          </p>
        </section>

        <nav className="user-nav-actions" aria-label="Profile actions">
          <Link to="/dashboard" className="user-link-btn">Back to Listings</Link>
          <button onClick={onLogout} className="user-logout-btn">Logout</button>
        </nav>
      </header>

      <section className="profile-grid">
        <article className="user-panel profile-card">
          <h2>Profile Picture</h2>
          <figure className="avatar-frame" aria-label="Profile avatar placeholder">
            {profileImageUrl ? (
              <img src={profileImageUrl} alt="Applicant profile" className="avatar-image" />
            ) : (
              <span>TM</span>
            )}
          </figure>
          <button
            type="button"
            className="user-action-btn"
            onClick={() => {
              if (!ensureUploadReady()) return
              profileInputRef.current?.click()
            }}
          >
            Upload profile picture
          </button>
          <input
            ref={profileInputRef}
            type="file"
            accept="image/*"
            onChange={handleProfileUpload}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="user-action-btn"
            onClick={handleDeleteProfilePicture}
            disabled={!profileImageName}
          >
            Delete profile picture
          </button>
        </article>

        <article className="user-panel profile-card">
          <h2>About Me</h2>
          <textarea
            className="about-me-input"
            value={aboutMe}
            onChange={(event) => setAboutMe(event.target.value)}
            rows={4}
            aria-label="About me description"
          />
          <button
            type="button"
            className="user-action-btn"
            onClick={handleAboutSave}
          >
            Save profile description
          </button>
        </article>
      </section>

      <section className="user-panel document-panel">
        <h2>My Documents</h2>
        <p className="user-panel-copy">Manage your uploaded CV and supporting documents in one place.</p>

        {isLoadingFiles ? <p className="user-item-meta">Loading your files...</p> : null}

        <menu className="doc-action-row">
          <li>
            <button
              type="button"
              className="user-action-btn"
              onClick={() => {
                if (!ensureUploadReady()) return
                cvInputRef.current?.click()
              }}
            >
              Upload CV
            </button>
          </li>
          <li>
            <button
              type="button"
              className="user-action-btn"
              onClick={() => {
                if (!ensureUploadReady()) return
                docsInputRef.current?.click()
              }}
            >
              Upload new document
            </button>
          </li>
        </menu>

        <ul className="user-list doc-list">
          {uploadedDocs.length === 0 ? (
            <li>
              <strong>No files uploaded yet</strong>
              <small className="user-item-meta">Upload your CV or documents to get started.</small>
            </li>
          ) : uploadedDocs.map((doc) => (
            <li key={doc.name}>
              <button
                type="button"
                onClick={() => openDocument(doc.name)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.5rem 0',
                  textAlign: 'left',
                  width: '100%',
                  display: 'block',
                }}
              >
                <strong style={{ color: 'white', textDecoration: 'underline' }}>{doc.name}</strong>
                <br />
                <small className="user-item-meta">Click to view</small>
              </button>
              <button
                type="button"
                className="user-action-btn"
                onClick={() => handleDeleteDocument(doc.name)}
                style={{ marginTop: '0.5rem' }}
              >
                Delete document
              </button>
            </li>
          ))}
        </ul>

        <input
          ref={cvInputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={handleCvUpload}
          style={{ display: 'none' }}
        />
        <input
          ref={docsInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
          onChange={handleDocumentUpload}
          style={{ display: 'none' }}
        />
      </section>
      </section>
    </main>
  )
}
