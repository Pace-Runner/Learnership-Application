import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'
import './UserPages.css'

const PROFILE_BUCKET = 'profile-images'
const DOCS_BUCKET = 'applicant-documents'
const MAX_CV_SIZE_BYTES = 5 * 1024 * 1024
const CV_TYPE_ALLOWLIST = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const skillSuggestionLibrary = [
  'Customer Service',
  'Administration',
  'Data Entry',
  'Microsoft Excel',
  'Microsoft Word',
  'Communication',
  'Teamwork',
  'Problem Solving',
  'Reception',
  'Office Management',
  'Project Coordination',
  'Scheduling',
  'Bookkeeping',
  'Accounting Basics',
  'Cash Handling',
  'Retail Sales',
  'Merchandising',
  'Inventory Control',
  'Procurement',
  'Logistics',
  'Warehouse Operations',
  'Computer Literacy',
  'Email Management',
  'CRM Administration',
  'Digital Marketing',
  'Social Media',
  'Content Writing',
  'Graphic Design',
  'Web Research',
  'Front Office',
  'Call Centre Support',
  'Operations Support',
  'Human Resources',
  'Recruitment Support',
  'Project Support',
  'Customer Relations',
  'Business Analysis',
  'Health and Safety',
  'Electrical Safety',
]

const defaultProfileForm = {
  first_name: '',
  last_name: '',
  phone: '',
  location: '',
  date_of_birth: '',
  id_number: '',
  cv_url: '',
  about_me:
    'Ambitious entry-level candidate interested in business administration and digital operations roles.',
}

function createEducationRow() {
  return {
    institution: '',
    qualification_id: '',
    nqf_level: '',
    year_completed: '',
  }
}

function isCvFile(file) {
  const extensionOk = /\.(pdf|doc|docx)$/i.test(file.name || '')
  const typeOk = CV_TYPE_ALLOWLIST.includes(file.type || '')
  return extensionOk || typeOk
}

function normalizeSkillName(value) {
  return value.replace(/\s+/g, ' ').trim()
}

export default function ApplicantProfile({ onLogout }) {
  const [userId, setUserId] = useState('')
  const [profileId, setProfileId] = useState('')

  const [profileForm, setProfileForm] = useState(defaultProfileForm)
  const [educationRows, setEducationRows] = useState([createEducationRow()])
  const [selectedSkillTagIds, setSelectedSkillTagIds] = useState([])

  const [qualificationOptions, setQualificationOptions] = useState([])
  const [skillTagOptions, setSkillTagOptions] = useState([])
  const [dropdownError, setDropdownError] = useState('')
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(true)

  const [profileImageUrl, setProfileImageUrl] = useState('')
  const [profileImageName, setProfileImageName] = useState('')
  const [cvLinkUrl, setCvLinkUrl] = useState('')
  const [uploadedDocs, setUploadedDocs] = useState([])

  const [isLoadingFiles, setIsLoadingFiles] = useState(true)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')
  const [skillDraft, setSkillDraft] = useState('')
  const [skillSearch, setSkillSearch] = useState('')
  const [skillError, setSkillError] = useState('')
  const [isAddingSkill, setIsAddingSkill] = useState(false)

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

  const nqfLevels = useMemo(() => Array.from({ length: 10 }, (_, index) => String(index + 1)), [])
  const initials = useMemo(() => {
    const firstInitial = profileForm.first_name?.trim()?.charAt(0) || ''
    const lastInitial = profileForm.last_name?.trim()?.charAt(0) || ''
    const value = `${firstInitial}${lastInitial}`.toUpperCase()
    return value || 'AP'
  }, [profileForm.first_name, profileForm.last_name])
  const selectedSkillTags = useMemo(
    () => skillTagOptions.filter((skillTag) => selectedSkillTagIds.includes(skillTag.id)),
    [selectedSkillTagIds, skillTagOptions],
  )
  const recommendedSkillTags = useMemo(
    () =>
      skillSuggestionLibrary.map((name) => ({
        id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name,
        isSuggested: true,
      })),
    [],
  )
  const visibleSkillTags = useMemo(() => {
    const normalizedSearch = skillSearch.trim().toLowerCase()
    const mergedSuggestions = [...skillTagOptions]

    recommendedSkillTags.forEach((suggestion) => {
      if (!mergedSuggestions.some((skillTag) => skillTag.name.toLowerCase() === suggestion.name.toLowerCase())) {
        mergedSuggestions.push(suggestion)
      }
    })

    return mergedSuggestions
      .filter((skillTag) => {
        if (!normalizedSearch) {
          return true
        }

        return skillTag.name.toLowerCase().includes(normalizedSearch)
      })
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(0, normalizedSearch ? 30 : 8)
  }, [recommendedSkillTags, skillSearch, skillTagOptions])

  const fetchDropdownData = useCallback(async () => {
    setIsLoadingDropdowns(true)

    if (!hasSupabaseConfig) {
      setQualificationOptions([])
      setSkillTagOptions([])
      setDropdownError('Supabase is not configured for dropdown loading.')
      setIsLoadingDropdowns(false)
      return
    }

    const [{ data: qualifications, error: qualificationsError }, { data: tags, error: tagsError }] =
      await Promise.all([
        supabase
          .from('nqf_qualifications')
          .select('id,title,nqf_level,saqa_id')
          .order('nqf_level', { ascending: true }),
        supabase.from('skill_tags').select('id,name').order('name', { ascending: true }),
      ])

    if (qualificationsError || tagsError) {
      setDropdownError('Could not load qualification and skills options right now.')
      setQualificationOptions([])
      setSkillTagOptions([])
      setIsLoadingDropdowns(false)
      return
    }

    setDropdownError('')
    setQualificationOptions(qualifications || [])
    setSkillTagOptions(tags || [])
    setIsLoadingDropdowns(false)
  }, [])

  const resolveCvLink = useCallback(async (authUserId, storedCvValue) => {
    if (!storedCvValue) {
      setCvLinkUrl('')
      return
    }

    if (/^https?:\/\//i.test(storedCvValue)) {
      setCvLinkUrl(storedCvValue)
      return
    }

    const normalizedPath = storedCvValue.includes('/') ? storedCvValue : `${authUserId}/${storedCvValue}`
    const { data, error } = await supabase.storage.from(DOCS_BUCKET).createSignedUrl(normalizedPath, 60 * 10)

    if (error || !data?.signedUrl) {
      setCvLinkUrl('')
      return
    }

    setCvLinkUrl(data.signedUrl)
  }, [])

  const fetchFiles = useCallback(
    async (authUserId) => {
      if (!authUserId || !hasSupabaseConfig) {
        setIsLoadingFiles(false)
        return
      }

      setIsLoadingFiles(true)

      const { data: loadedProfile } = await supabase
        .from('applicant_profiles')
        .select('*')
        .eq('user_id', authUserId)
        .maybeSingle()

      const nextProfileId = loadedProfile?.id || ''
      setProfileId(nextProfileId)

      if (loadedProfile) {
        setProfileForm((current) => ({
          ...current,
          first_name: loadedProfile.first_name || '',
          last_name: loadedProfile.last_name || '',
          phone: loadedProfile.phone || '',
          location: loadedProfile.location || '',
          date_of_birth: loadedProfile.date_of_birth || '',
          id_number: loadedProfile.id_number || '',
          cv_url: loadedProfile.cv_url || '',
          about_me: loadedProfile.about_me || current.about_me,
        }))

        await resolveCvLink(authUserId, loadedProfile.cv_url || '')
      } else {
        setProfileForm(defaultProfileForm)
        setCvLinkUrl('')
      }

      if (nextProfileId) {
        const [{ data: educations }, { data: skills }] = await Promise.all([
          supabase
            .from('applicant_education')
            .select('institution,qualification_id,nqf_level,year_completed')
            .eq('applicant_id', nextProfileId)
            .order('year_completed', { ascending: false }),
          supabase.from('applicant_skills').select('skill_tag_id').eq('applicant_id', nextProfileId),
        ])

        if (educations?.length) {
          setEducationRows(
            educations.map((row) => ({
              institution: row.institution || '',
              qualification_id: row.qualification_id || '',
              nqf_level: row.nqf_level ? String(row.nqf_level) : '',
              year_completed: row.year_completed ? String(row.year_completed) : '',
            })),
          )
        } else {
          setEducationRows([createEducationRow()])
        }

        setSelectedSkillTagIds((skills || []).map((row) => row.skill_tag_id).filter(Boolean))
      } else {
        setEducationRows([createEducationRow()])
        setSelectedSkillTagIds([])
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
          .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')),
      )

      setIsLoadingFiles(false)
    },
    [resolveCvLink],
  )

  useEffect(() => {
    let isMounted = true

    const loadUserFiles = async () => {
      await fetchDropdownData()

      if (!hasSupabaseConfig) {
        if (isMounted) {
          setIsLoadingFiles(false)
          setUploadMessage('Supabase is not configured yet. Add env vars to enable uploads.')
        }
        return
      }

      const { data } = await supabase.auth.getUser()
      const authUserId = data?.user?.id || ''

      if (!isMounted) {
        return
      }

      setUserId(authUserId)
      await fetchFiles(authUserId)
    }

    loadUserFiles()

    return () => {
      isMounted = false
    }
  }, [fetchDropdownData, fetchFiles])

  const handleProfileFieldChange = (fieldName, value) => {
    setProfileForm((current) => ({
      ...current,
      [fieldName]: value,
    }))
  }

  const handleEducationRowChange = (index, fieldName, value) => {
    setEducationRows((currentRows) =>
      currentRows.map((row, rowIndex) => {
        if (rowIndex !== index) {
          return row
        }

        return {
          ...row,
          [fieldName]: value,
        }
      }),
    )
  }

  const handleAddEducation = () => {
    setEducationRows((current) => [...current, createEducationRow()])
  }

  const handleRemoveEducation = (index) => {
    setEducationRows((current) => {
      if (current.length <= 1) {
        return [createEducationRow()]
      }

      return current.filter((_, rowIndex) => rowIndex !== index)
    })
  }

  const toggleSkillSelection = (skillTagId) => {
    setSelectedSkillTagIds((current) => {
      if (current.includes(skillTagId)) {
        return current.filter((id) => id !== skillTagId)
      }

      return [...current, skillTagId]
    })
  }

  const handleCreateSkill = async (skillName = skillDraft) => {
    if (!hasSupabaseConfig || !userId) {
      setSkillError('Sign in and configure Supabase before adding skills.')
      return
    }

    const normalizedName = normalizeSkillName(skillName)
    if (!normalizedName) {
      setSkillError('Enter a skill name first.')
      return
    }

    const existingSkill = skillTagOptions.find(
      (skillTag) => skillTag.name.toLowerCase() === normalizedName.toLowerCase(),
    )

    if (existingSkill) {
      setSkillError('')
      setSelectedSkillTagIds((current) => {
        if (current.includes(existingSkill.id)) {
          return current
        }
        return [...current, existingSkill.id]
      })
      setSkillDraft('')
      return
    }

    setIsAddingSkill(true)
    setSkillError('')

    const { data: insertedSkill, error } = await supabase
      .from('skill_tags')
      .insert({ name: normalizedName, nqf_aligned: false })
      .select('id,name')
      .single()

    if (error || !insertedSkill?.id) {
      const { data: fallbackSkill } = await supabase
        .from('skill_tags')
        .select('id,name')
        .ilike('name', normalizedName)
        .maybeSingle()

      if (!fallbackSkill?.id) {
        setIsAddingSkill(false)
        setSkillError('Could not create this skill right now. Please try again.')
        return
      }

      setSkillTagOptions((current) =>
        [...current, fallbackSkill].sort((left, right) => left.name.localeCompare(right.name)),
      )
      setSelectedSkillTagIds((current) => {
        if (current.includes(fallbackSkill.id)) {
          return current
        }
        return [...current, fallbackSkill.id]
      })
      setSkillDraft('')
      setIsAddingSkill(false)
      return
    }

    setSkillTagOptions((current) =>
      [...current, insertedSkill].sort((left, right) => left.name.localeCompare(right.name)),
    )
    setSelectedSkillTagIds((current) => [...current, insertedSkill.id])
    setSkillDraft('')
    setIsAddingSkill(false)
  }

  const handleSelectSuggestedSkill = async (skillName) => {
    await handleCreateSkill(skillName)
  }

  const validateProfileForm = () => {
    if (!profileForm.first_name.trim()) return 'First name is required.'
    if (!profileForm.last_name.trim()) return 'Last name is required.'
    if (!profileForm.phone.trim()) return 'Phone number is required.'
    if (!profileForm.location.trim()) return 'Location is required.'
    if (!profileForm.id_number.trim()) return 'ID number is required.'

    const hasInvalidEducation = educationRows.some((row) => {
      const anyField = row.institution || row.qualification_id || row.nqf_level || row.year_completed
      if (!anyField) {
        return false
      }
      return !row.institution || !row.qualification_id || !row.nqf_level
    })

    if (hasInvalidEducation) {
      return 'Each education entry must include institution, qualification, and NQF level.'
    }

    return ''
  }

  const handleSaveFullProfile = async () => {
    if (!userId || !hasSupabaseConfig) {
      setUploadMessage('Please sign in and ensure Supabase is configured before saving.')
      return
    }

    const validationError = validateProfileForm()
    if (validationError) {
      setUploadMessage(validationError)
      return
    }

    setIsSavingProfile(true)
    setUploadMessage('Saving profile...')

    const profilePayload = {
      user_id: userId,
      first_name: profileForm.first_name.trim(),
      last_name: profileForm.last_name.trim(),
      phone: profileForm.phone.trim(),
      location: profileForm.location.trim(),
      date_of_birth: profileForm.date_of_birth || null,
      id_number: profileForm.id_number.trim(),
      cv_url: profileForm.cv_url || null,
      about_me: profileForm.about_me.trim() || null,
    }

    let resolvedProfileId = profileId

    if (resolvedProfileId) {
      const { error: updateError } = await supabase
        .from('applicant_profiles')
        .update(profilePayload)
        .eq('id', resolvedProfileId)

      if (updateError) {
        setIsSavingProfile(false)
        setUploadMessage('Could not save profile. Please try again.')
        return
      }
    } else {
      const { data: insertedProfile, error: insertError } = await supabase
        .from('applicant_profiles')
        .insert(profilePayload)
        .select('id')
        .single()

      if (insertError || !insertedProfile?.id) {
        setIsSavingProfile(false)
        setUploadMessage('Could not create profile. Please try again.')
        return
      }

      resolvedProfileId = insertedProfile.id
      setProfileId(insertedProfile.id)
    }

    await Promise.all([
      supabase.from('applicant_education').delete().eq('applicant_id', resolvedProfileId),
      supabase.from('applicant_skills').delete().eq('applicant_id', resolvedProfileId),
    ])

    const educationPayload = educationRows
      .filter((row) => row.institution || row.qualification_id || row.nqf_level || row.year_completed)
      .map((row) => ({
        applicant_id: resolvedProfileId,
        institution: row.institution.trim(),
        qualification_id: row.qualification_id || null,
        nqf_level: row.nqf_level ? Number(row.nqf_level) : null,
        year_completed: row.year_completed ? Number(row.year_completed) : null,
      }))

    if (educationPayload.length > 0) {
      const { error: educationError } = await supabase.from('applicant_education').insert(educationPayload)
      if (educationError) {
        setIsSavingProfile(false)
        setUploadMessage('Profile saved, but education entries failed to save.')
        return
      }
    }

    if (selectedSkillTagIds.length > 0) {
      const skillsPayload = selectedSkillTagIds.map((skillTagId) => ({
        applicant_id: resolvedProfileId,
        skill_tag_id: skillTagId,
      }))

      const { error: skillsError } = await supabase.from('applicant_skills').insert(skillsPayload)
      if (skillsError) {
        setIsSavingProfile(false)
        setUploadMessage('Profile saved, but selected skills failed to save.')
        return
      }
    }

    setIsSavingProfile(false)
    setUploadMessage('Profile, education, and skills saved successfully.')
  }

  const handleProfileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !userId) return

    setUploadMessage('Uploading profile picture...')

    const extension = file.name.split('.').pop() || 'jpg'
    const filePath = `${userId}/profile.${extension}`

    const { error } = await supabase.storage.from(PROFILE_BUCKET).upload(filePath, file, { upsert: true })

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

      const { error } = await supabase.storage.from(DOCS_BUCKET).upload(filePath, file, { upsert: false })

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

    if (!isCvFile(file)) {
      setUploadMessage('Only PDF and DOCX files are allowed for CV uploads.')
      event.target.value = ''
      return
    }

    if (file.size > MAX_CV_SIZE_BYTES) {
      setUploadMessage('The selected CV is too large. Maximum size is 5MB.')
      event.target.value = ''
      return
    }

    setUploadMessage('Uploading CV...')

    const safeName = file.name.replace(/\s+/g, '_')
    const filePath = `${userId}/${Date.now()}-cv-${safeName}`

    const { error } = await supabase.storage.from(DOCS_BUCKET).upload(filePath, file, { upsert: false })

    event.target.value = ''

    if (error) {
      setUploadMessage('CV upload failed. Please try again.')
      setTimeout(() => setUploadMessage(''), 3000)
      return
    }

    setProfileForm((current) => ({
      ...current,
      cv_url: filePath,
    }))

    await supabase.from('applicant_profiles').update({ cv_url: filePath }).eq('user_id', userId)
    await resolveCvLink(userId, filePath)

    setUploadMessage('CV uploaded successfully.')
    setTimeout(() => setUploadMessage(''), 3000)
    await fetchFiles(userId)
  }

  const handleDeleteDocument = async (fileName) => {
    if (!userId || !fileName) return

    setUploadMessage('Deleting document...')

    const { error } = await supabase.storage.from(DOCS_BUCKET).remove([`${userId}/${fileName}`])

    if (error) {
      setUploadMessage('Could not delete this document right now.')
      setTimeout(() => setUploadMessage(''), 3000)
      return
    }

    const isCurrentCv = profileForm.cv_url.endsWith(fileName)
    if (isCurrentCv) {
      await supabase.from('applicant_profiles').update({ cv_url: null }).eq('user_id', userId)
      setProfileForm((current) => ({
        ...current,
        cv_url: '',
      }))
      setCvLinkUrl('')
    }

    setUploadMessage('Document deleted.')
    setTimeout(() => setUploadMessage(''), 3000)
    await fetchFiles(userId)
  }

  const handleDeleteProfilePicture = async () => {
    if (!userId || !profileImageName) return

    setUploadMessage('Deleting profile picture...')

    const { error } = await supabase.storage.from(PROFILE_BUCKET).remove([`${userId}/${profileImageName}`])

    if (error) {
      setUploadMessage('Could not delete profile picture right now.')
      setTimeout(() => setUploadMessage(''), 3000)
      return
    }

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

  return (
    <main className="user-page applicant-theme profile-shell">
      <section className="user-page-inner">
        <header className="user-hero profile-header">
          <section>
            <p className="user-kicker">Applicant Profile</p>
            <h1>Profile and documents</h1>
            {uploadMessage ? <p className="user-item-meta">{uploadMessage}</p> : null}
            {isLoadingDropdowns ? <p className="user-item-meta">Loading qualification and skills data...</p> : null}
            {dropdownError ? <p className="user-item-meta">{dropdownError}</p> : null}
            {skillError ? <p className="user-item-meta">{skillError}</p> : null}
            <p className="user-intro">
              Keep your profile complete so applications are easier to review by employers and training
              providers.
            </p>
          </section>

          <nav className="user-nav-actions" aria-label="Profile actions">
            <Link to="/dashboard" className="user-link-btn">
              Back to Listings
            </Link>
            <button onClick={onLogout} className="user-logout-btn">
              Logout
            </button>
          </nav>
        </header>

        <section className="profile-overview-grid">
          <article className="user-panel profile-card profile-identity-card">
            <h2>Profile Picture</h2>
            <figure className="avatar-frame" aria-label="Profile avatar placeholder">
              {profileImageUrl ? (
                <img src={profileImageUrl} alt="Applicant profile" className="avatar-image" />
              ) : (
                <span>{initials}</span>
              )}
            </figure>
            <p className="profile-name-pill">
              {profileForm.first_name || 'First'} {profileForm.last_name || 'Last'}
            </p>
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
              className="user-action-btn user-action-btn-muted"
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
              value={profileForm.about_me}
              onChange={(event) => handleProfileFieldChange('about_me', event.target.value)}
              rows={4}
              aria-label="About me description"
            />
            <p className="user-item-meta">Write a concise summary of your strengths, goals, and practical experience.</p>
          </article>
        </section>

        <section className="user-panel profile-card profile-card-personal">
          <h2>Personal details</h2>
          <div className="profile-fields-grid">
            <label className="profile-field" htmlFor="profile-first-name">
              <span>First name</span>
              <input
                className="profile-input"
                id="profile-first-name"
                value={profileForm.first_name}
                onChange={(event) => handleProfileFieldChange('first_name', event.target.value)}
              />
            </label>

            <label className="profile-field" htmlFor="profile-last-name">
              <span>Last name</span>
              <input
                className="profile-input"
                id="profile-last-name"
                value={profileForm.last_name}
                onChange={(event) => handleProfileFieldChange('last_name', event.target.value)}
              />
            </label>

            <label className="profile-field" htmlFor="profile-phone">
              <span>Phone</span>
              <input
                className="profile-input"
                id="profile-phone"
                value={profileForm.phone}
                onChange={(event) => handleProfileFieldChange('phone', event.target.value)}
              />
            </label>

            <label className="profile-field" htmlFor="profile-location">
              <span>Location</span>
              <input
                className="profile-input"
                id="profile-location"
                value={profileForm.location}
                onChange={(event) => handleProfileFieldChange('location', event.target.value)}
              />
            </label>

            <label className="profile-field" htmlFor="profile-id-number">
              <span>ID number</span>
              <input
                className="profile-input"
                id="profile-id-number"
                value={profileForm.id_number}
                onChange={(event) => handleProfileFieldChange('id_number', event.target.value)}
              />
            </label>

            <label className="profile-field" htmlFor="profile-date-of-birth">
              <span>Date of birth</span>
              <input
                className="profile-input"
                id="profile-date-of-birth"
                type="date"
                value={profileForm.date_of_birth}
                onChange={(event) => handleProfileFieldChange('date_of_birth', event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="user-panel profile-card profile-card-education">
          <div className="profile-section-header">
            <h2>Education</h2>
            <button type="button" className="user-action-btn user-action-btn-inline" onClick={handleAddEducation}>
              Add education entry
            </button>
          </div>

          <div className="education-grid-stack">
            {educationRows.map((row, index) => (
              <section key={`education-${index}`} className="education-row-card">
                <div className="profile-section-header">
                  <p className="education-row-title">Entry {index + 1}</p>
                  <button
                    type="button"
                    className="user-action-btn user-action-btn-inline user-action-btn-muted"
                    onClick={() => handleRemoveEducation(index)}
                  >
                    Remove
                  </button>
                </div>

                <div className="education-row-grid">
                  <label className="profile-field" htmlFor={`education-institution-${index}`}>
                    <span>Institution</span>
                    <input
                      className="profile-input"
                      id={`education-institution-${index}`}
                      value={row.institution}
                      onChange={(event) => handleEducationRowChange(index, 'institution', event.target.value)}
                    />
                  </label>

                  <label className="profile-field" htmlFor={`education-qualification-${index}`}>
                    <span>Qualification</span>
                    <select
                      className="profile-input"
                      id={`education-qualification-${index}`}
                      value={row.qualification_id}
                      onChange={(event) => handleEducationRowChange(index, 'qualification_id', event.target.value)}
                    >
                      <option value="">Select qualification</option>
                      {qualificationOptions.map((qualification) => (
                        <option key={qualification.id} value={qualification.id}>
                          {qualification.title} (NQF {qualification.nqf_level})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="profile-field" htmlFor={`education-nqf-level-${index}`}>
                    <span>NQF level</span>
                    <select
                      className="profile-input"
                      id={`education-nqf-level-${index}`}
                      value={row.nqf_level}
                      onChange={(event) => handleEducationRowChange(index, 'nqf_level', event.target.value)}
                    >
                      <option value="">Select NQF level</option>
                      {nqfLevels.map((level) => (
                        <option key={level} value={level}>
                          NQF level {level}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="profile-field" htmlFor={`education-year-${index}`}>
                    <span>Year completed</span>
                    <input
                      className="profile-input"
                      id={`education-year-${index}`}
                      type="number"
                      placeholder="2025"
                      value={row.year_completed}
                      onChange={(event) => handleEducationRowChange(index, 'year_completed', event.target.value)}
                    />
                  </label>
                </div>
              </section>
            ))}
          </div>
        </section>

        <section className="user-panel profile-card profile-card-skills">
          <h2>Skills</h2>
          <p className="user-panel-copy">
            Start with a few common skills. Search to reveal more fields or add your own custom skill.
          </p>

          <div className="skills-create-row">
            <input
              className="profile-input"
              value={skillDraft}
              onChange={(event) => setSkillDraft(event.target.value)}
              placeholder="Add a new skill (e.g. CRM Administration)"
              aria-label="Add custom skill"
            />
            <button
              type="button"
              className="user-action-btn user-action-btn-inline"
              onClick={handleCreateSkill}
              disabled={isAddingSkill}
            >
              {isAddingSkill ? 'Adding...' : 'Add skill'}
            </button>
          </div>

          <label className="profile-field profile-search-field" htmlFor="skill-search">
            <span>Search available skills</span>
            <input
              id="skill-search"
              className="profile-input"
              value={skillSearch}
              onChange={(event) => setSkillSearch(event.target.value)}
              placeholder="Type to filter skill library"
            />
          </label>

          <div className="skill-pill-group skill-pill-group-selected" aria-label="Selected skills">
            {selectedSkillTags.length === 0 ? (
              <p className="user-item-meta">No skills selected yet.</p>
            ) : (
              selectedSkillTags.map((skillTag) => (
                <button
                  key={skillTag.id}
                  type="button"
                  className="skill-pill skill-pill-active"
                  onClick={() => toggleSkillSelection(skillTag.id)}
                  aria-label={`Remove ${skillTag.name}`}
                >
                  {skillTag.name} x
                </button>
              ))
            )}
          </div>

          <div className="skill-pill-group skill-pill-group-suggested" aria-label="Available skills">
            {visibleSkillTags.length === 0 ? (
              <p className="user-item-meta">No matching skills found.</p>
            ) : (
              visibleSkillTags.map((skillTag) => (
                <button
                  key={skillTag.id}
                  type="button"
                  className={`skill-pill ${selectedSkillTagIds.includes(skillTag.id) ? 'skill-pill-active' : ''}`}
                  onClick={() => {
                    if (skillTag.isSuggested) {
                      void handleSelectSuggestedSkill(skillTag.name)
                      return
                    }

                    toggleSkillSelection(skillTag.id)
                  }}
                  aria-pressed={selectedSkillTagIds.includes(skillTag.id)}
                >
                  {skillTag.name}
                </button>
              ))
            )}
          </div>
        </section>

        <section className="user-panel document-panel profile-card-documents">
          <h2>My Documents</h2>
          <p className="user-panel-copy">Manage your uploaded CV and supporting documents in one place.</p>

          {cvLinkUrl ? (
            <p className="user-item-meta">
              Current CV: <a href={cvLinkUrl}>Open uploaded CV</a>
            </p>
          ) : null}

          {isLoadingFiles ? <p className="user-item-meta">Loading your files...</p> : null}

          <menu className="doc-action-row">
            <li>
              <button
                type="button"
                className="user-action-btn user-action-btn-inline"
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
                className="user-action-btn user-action-btn-inline"
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
            ) : (
              uploadedDocs.map((doc) => (
                <li key={doc.name}>
                  <button
                    type="button"
                    className="doc-open-btn"
                    onClick={() => openDocument(doc.name)}
                  >
                    <strong>{doc.name}</strong>
                    <br />
                    <small className="user-item-meta">Click to view</small>
                  </button>
                  <button
                    type="button"
                    className="user-action-btn"
                    onClick={() => handleDeleteDocument(doc.name)}
                  >
                    Delete document
                  </button>
                </li>
              ))
            )}
          </ul>

          <button
            type="button"
            className="user-action-btn profile-save-btn"
            onClick={handleSaveFullProfile}
            disabled={isSavingProfile}
          >
            {isSavingProfile ? 'Saving...' : 'Save full profile'}
          </button>

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
