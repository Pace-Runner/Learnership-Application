/* istanbul ignore file */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
/* eslint-disable react-refresh/only-export-components */
import { Link } from 'react-router-dom'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'
import './UserPages.css'

const PROFILE_BUCKET = 'profile-images'
const DOCS_BUCKET = 'applicants/documents'
const MAX_CV_SIZE_BYTES = 5 * 1024 * 1024
const CV_TYPE_ALLOWLIST = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

const skillSuggestionLibrary = [
  'Accounting Basics',
  'Administration',
  'Business Analysis',
  'Bookkeeping',
  'Call Centre Support',
  'Cash Handling',
  'Communication',
  'Computer Literacy',
  'Content Writing',
  'CRM Administration',
  'Customer Relations',
  'Customer Service',
  'Data Analysis',
  'Data Entry',
  'Digital Marketing',
  'Electrical Safety',
  'Email Management',
  'Event Planning',
  'Financial Analysis',
  'Front Office',
  'Graphic Design',
  'Health and Safety',
  'Human Resources',
  'Inventory Control',
  'Invoicing',
  'Logistics',
  'Mentoring',
  'Merchandising',
  'Microsoft Excel',
  'Microsoft PowerPoint',
  'Microsoft Word',
  'Office Management',
  'Operations Support',
  'Payroll',
  'Problem Solving',
  'Procurement',
  'Project Coordination',
  'Project Management',
  'Project Support',
  'Public Speaking',
  'Quality Assurance',
  'Reception',
  'Recruitment Support',
  'Retail Sales',
  'Sales',
  'Scheduling',
  'Social Media',
  'Team Leadership',
  'Teamwork',
  'Time Management',
  'Training',
  'Warehouse Operations',
  'Web Research',
  'Writing',
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

function getFriendlySupabaseError(error, fallbackMessage) {
  if (!error) {
    return fallbackMessage
  }

  const code = error.code || ''
  const message = (error.message || '').toLowerCase()

  if (code === '42501' || message.includes('row-level security')) {
    return 'You do not have permission to perform this action yet. Please run the latest RLS SQL script and sign in again.'
  }

  if (code === '23503' || message.includes('foreign key')) {
    return 'Your account link is incomplete in the database. Please log out, log back in, and try again.'
  }

  if (code === '23505' || message.includes('duplicate')) {
    return 'This record already exists. Try refreshing the page and saving again.'
  }

  if (code === '22P02' || message.includes('invalid input syntax')) {
    return 'One of the field values has an invalid format. Please check phone, ID number, and education year.'
  }

  if (message.includes('failed to fetch') || message.includes('network')) {
    return 'Network error while saving. Please check your internet connection and try again.'
  }

  return error.message || fallbackMessage
}

function debugLog(...messages) {
  if (import.meta.env.MODE === 'development') {
    console.log(...messages)
  }
}

// Main applicant page: handles profile form state, uploads, validation, and saves.
export { createEducationRow, isCvFile, getFriendlySupabaseError }

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
  const [showSavedConfirmation, setShowSavedConfirmation] = useState(false)
  const [skillSearch, setSkillSearch] = useState('')
  const [showAllSkills, setShowAllSkills] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [educationFieldErrors, setEducationFieldErrors] = useState({})
  const [isBootstrapping, setIsBootstrapping] = useState(true)

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
  const recommendedSkillTags = useMemo(
    () =>
      skillSuggestionLibrary.map((name) => ({
        id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        name,
        isSuggested: true,
      })),
    [],
  )
  const allSelectedSkills = useMemo(() => {
    const dbSkills = skillTagOptions.filter((skillTag) => selectedSkillTagIds.includes(skillTag.id))
    const suggestedSkills = recommendedSkillTags.filter((skillTag) => selectedSkillTagIds.includes(skillTag.id))
    return [...dbSkills, ...suggestedSkills].sort((left, right) => left.name.localeCompare(right.name))
  }, [selectedSkillTagIds, skillTagOptions, recommendedSkillTags])
  const visibleSkillTags = useMemo(() => {
    const normalizedSearch = skillSearch.trim().toLowerCase()
    const mergedSuggestions = [...skillTagOptions]

    recommendedSkillTags.forEach((suggestion) => {
      if (!mergedSuggestions.some((skillTag) => skillTag.name.toLowerCase() === suggestion.name.toLowerCase())) {
        mergedSuggestions.push(suggestion)
      }
    })

    const filtered = mergedSuggestions
      .filter((skillTag) => {
        if (!normalizedSearch) {
          return true
        }

        return skillTag.name.toLowerCase().includes(normalizedSearch)
      })
      .sort((left, right) => left.name.localeCompare(right.name))

    if (normalizedSearch) {
      return filtered.slice(0, 30)
    }

    return filtered.slice(0, showAllSkills ? filtered.length : 12)
  }, [recommendedSkillTags, skillSearch, skillTagOptions, showAllSkills])

  const fetchDropdownData = useCallback(async () => {
    setIsLoadingDropdowns(true)

    if (!hasSupabaseConfig) {
      setQualificationOptions([])
      setSkillTagOptions([])
      setDropdownError('Supabase is not configured for dropdown loading.')
      setIsLoadingDropdowns(false)
      return
    }

    // Load real qualification and skill options so profile selections come from seeded tables.
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

  // Turns a stored CV value into a browser-openable link.
  // If we stored only a file path, we generate a short-lived signed URL from Supabase Storage.
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

    const resolveLink = async (bucket, path) => {
      try {
        const signed = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10)
        if (signed?.data?.signedUrl) return signed.data.signedUrl

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

        const pub = await supabase.storage.from(bucket).getPublicUrl(path)
        return pub?.data?.publicUrl || ''
      } catch (e) {
        try {
          const pub = await supabase.storage.from(bucket).getPublicUrl(path)
          if (pub?.data?.publicUrl) return pub.data.publicUrl
        } catch (_) {
          if (bucket.includes('/')) {
            const [rootBucket, ...rest] = bucket.split('/')
            const prefix = rest.join('/')
            const altPath = prefix ? `${prefix}/${path}` : path
            try {
              const altSigned = await supabase.storage.from(rootBucket).createSignedUrl(altPath, 60 * 10)
              if (altSigned?.data?.signedUrl) return altSigned.data.signedUrl
            } catch (_) {}
            try {
              const altPublic = await supabase.storage.from(rootBucket).getPublicUrl(altPath)
              return altPublic?.data?.publicUrl || ''
            } catch (_) {}
          }
        }
        return ''
      }
    }

    const link = await resolveLink(DOCS_BUCKET, normalizedPath)
    setCvLinkUrl(link || '')
  }, [])

  const fetchStorageFiles = useCallback(async (authUserId) => {
    if (!authUserId || !hasSupabaseConfig) {
      setIsLoadingFiles(false)
      return
    }

    setIsLoadingFiles(true)

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
  }, [])

  // Ensures we can map the logged-in auth user to a row in the public `users` table.
  // Returns a stable user id used by profile tables.
  const resolveDatabaseUserId = useCallback(async (authUser) => {
    const authUserId = authUser?.id || ''
    const authUserEmail = authUser?.email || ''

    if (!authUserId || !hasSupabaseConfig) {
      return ''
    }

    if (!authUserEmail) {
      return authUserId
    }

    // 1) Try to find the user row by email.
    const { data: userRow, error: userLookupError } = await supabase
      .from('users')
      .select('id')
      .eq('email', authUserEmail)
      .maybeSingle()

    if (userLookupError) {
      console.error('Users lookup error:', userLookupError)
      return authUserId
    }

    if (userRow?.id) {
      return userRow.id
    }

    // 2) If not found, create a users row so foreign keys from profile tables can work.
    const { data: insertedUser, error: userInsertError } = await supabase
      .from('users')
      .insert({
        id: authUserId,
        email: authUserEmail,
        role: 'Applicant',
      })
      .select('id')
      .single()

    if (userInsertError) {
      console.error('Users insert error:', userInsertError)
      // If create failed due to a race/duplicate, try one last lookup and continue.
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', authUserEmail)
        .maybeSingle()
      return existingUser?.id || authUserId
    }

    return insertedUser?.id || authUserId
  }, [])

  const fetchFiles = useCallback(
    async (authUserId, databaseUserId) => {
      if (!authUserId || !databaseUserId || !hasSupabaseConfig) {
        setIsLoadingFiles(false)
        return
      }

      debugLog('Fetching profile data for auth user:', authUserId)
      debugLog('Using database user id:', databaseUserId)
      setIsLoadingFiles(true)

      const { data: loadedProfile } = await supabase
        .from('applicant_profiles')
        .select('*')
        .eq('user_id', databaseUserId)
        .maybeSingle()

      debugLog('Profile loaded:', loadedProfile)

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

        debugLog('Profile data loaded:')
        debugLog('  - Education entries:', educations?.length || 0)
        debugLog('  - Skills selected:', skills?.length || 0)
      } else {
        setEducationRows([createEducationRow()])
        setSelectedSkillTagIds([])
      }

      await fetchStorageFiles(authUserId)
    },
    [fetchStorageFiles, resolveCvLink],
  )

  useEffect(() => {
    let isMounted = true

    const loadUserFiles = async () => {
      try {
        await fetchDropdownData()

        if (!hasSupabaseConfig) {
          if (isMounted) {
            setIsLoadingFiles(false)
            setUploadMessage('Supabase is not configured yet. Add env vars to enable uploads.')
          }
          return
        }

        const { data } = await supabase.auth.getUser()
        const authUser = data?.user || null
        const authUserId = authUser?.id || ''

        if (!isMounted) {
          return
        }

        setUserId(authUserId)

        const databaseUserId = await resolveDatabaseUserId(authUser)
        if (!databaseUserId) {
          setUploadMessage('Could not link your account in the users table. Please contact support.')
          setIsLoadingFiles(false)
          return
        }

        await fetchFiles(authUserId, databaseUserId)
      } finally {
        if (isMounted) {
          setIsBootstrapping(false)
        }
      }
    }

    loadUserFiles()

    return () => {
      isMounted = false
    }
  }, [fetchDropdownData, fetchFiles, resolveDatabaseUserId])

  if (isBootstrapping) {
    return (
      <main className="auth-loading-shell" aria-busy="true" aria-live="polite">
        <p>Loading your profile...</p>
      </main>
    )
  }

  const handleProfileFieldChange = (fieldName, value) => {
    setProfileForm((current) => ({
      ...current,
      [fieldName]: value,
    }))

    setFieldErrors((current) => {
      if (!current[fieldName]) {
        return current
      }
      const next = { ...current }
      delete next[fieldName]
      return next
    })
  }

  const validateSingleProfileField = (fieldName, value) => {
    if (fieldName === 'first_name') {
      if (!String(value || '').trim()) {
        return 'First name is required.'
      }
      return ''
    }

    if (fieldName === 'last_name') {
      if (!String(value || '').trim()) {
        return 'Last name is required.'
      }
      return ''
    }

    if (fieldName === 'location') {
      if (!String(value || '').trim()) {
        return 'Location is required.'
      }
      return ''
    }

    if (fieldName === 'phone') {
      const normalizedPhone = String(value || '').replace(/\D/g, '')
      if (!normalizedPhone) {
        return 'Phone number is required.'
      }
      if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
        return 'Phone number must contain 10 to 15 digits.'
      }
      return ''
    }

    if (fieldName === 'id_number') {
      const normalizedIdNumber = String(value || '').replace(/\s+/g, '')
      if (!normalizedIdNumber) {
        return 'ID number is required.'
      }
      if (!/^\d{13}$/.test(normalizedIdNumber)) {
        return 'ID number must be exactly 13 digits.'
      }
      return ''
    }

    if (fieldName === 'date_of_birth') {
      if (!value) {
        return ''
      }
      const parsedDob = new Date(value)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (Number.isNaN(parsedDob.getTime()) || parsedDob > today) {
        return 'Date of birth cannot be in the future.'
      }
      return ''
    }

    return ''
  }

  const handleProfileFieldBlur = (fieldName, value) => {
    const message = validateSingleProfileField(fieldName, value)
    setFieldErrors((current) => {
      const next = { ...current }
      if (message) {
        next[fieldName] = message
      } else {
        delete next[fieldName]
      }
      return next
    })
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

    setEducationFieldErrors((current) => {
      const key = `${index}-${fieldName}`
      if (!current[key]) {
        return current
      }
      const next = { ...current }
      delete next[key]
      return next
    })
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

    // Reset row-indexed errors after removing an entry to avoid stale mappings.
    setEducationFieldErrors({})
  }

  const getEducationValidationErrors = (rows) => {
    const nextErrors = {}
    const currentYear = new Date().getFullYear()

    rows.forEach((row, index) => {
      const anyField = row.institution || row.qualification_id || row.nqf_level || row.year_completed
      if (!anyField) {
        return
      }

      if (!row.institution) {
        nextErrors[`${index}-institution`] = 'Institution is required for this education entry.'
      }
      if (!row.qualification_id) {
        nextErrors[`${index}-qualification_id`] = 'Qualification is required for this education entry.'
      }
      if (!row.nqf_level) {
        nextErrors[`${index}-nqf_level`] = 'NQF level is required for this education entry.'
      }

      if (row.year_completed) {
        const yearValue = Number(row.year_completed)
        if (!Number.isInteger(yearValue) || yearValue < 1900 || yearValue > currentYear + 1) {
          nextErrors[`${index}-year_completed`] = 'Year completed must be between 1900 and next year.'
        }
      }
    })

    return nextErrors
  }

  const toggleSkillSelection = (skillTagId) => {
    setSelectedSkillTagIds((current) => {
      if (current.includes(skillTagId)) {
        return current.filter((id) => id !== skillTagId)
      }

      return [...current, skillTagId]
    })
  }

  const validateProfileForm = () => {
    if (!profileForm.first_name.trim()) return 'First name is required.'
    if (!profileForm.last_name.trim()) return 'Last name is required.'
    if (!profileForm.phone.trim()) return 'Phone number is required.'
    if (!profileForm.location.trim()) return 'Location is required.'
    if (!profileForm.id_number.trim()) return 'ID number is required.'

    const normalizedPhone = profileForm.phone.replace(/\D/g, '')
    if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
      return 'Phone number must contain 10 to 15 digits.'
    }

    const normalizedIdNumber = profileForm.id_number.replace(/\s+/g, '')
    if (!/^\d{13}$/.test(normalizedIdNumber)) {
      return 'ID number must be exactly 13 digits.'
    }

    if (profileForm.date_of_birth) {
      const parsedDob = new Date(profileForm.date_of_birth)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (Number.isNaN(parsedDob.getTime()) || parsedDob > today) {
        return 'Date of birth cannot be in the future.'
      }
    }

    const currentYear = new Date().getFullYear()
    const hasInvalidEducationYear = educationRows.some((row) => {
      if (!row.year_completed) {
        return false
      }
      const yearValue = Number(row.year_completed)
      return !Number.isInteger(yearValue) || yearValue < 1900 || yearValue > currentYear + 1
    })

    if (hasInvalidEducationYear) {
      return 'Education year completed must be between 1900 and next year.'
    }

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

  const focusValidationField = (validationError) => {
    const messageToFieldId = {
      'First name is required.': 'profile-first-name',
      'Last name is required.': 'profile-last-name',
      'Phone number is required.': 'profile-phone',
      'Phone number must contain 10 to 15 digits.': 'profile-phone',
      'Location is required.': 'profile-location',
      'ID number is required.': 'profile-id-number',
      'ID number must be exactly 13 digits.': 'profile-id-number',
      'Date of birth cannot be in the future.': 'profile-date-of-birth',
      'Education year completed must be between 1900 and next year.': 'education-year-0',
      'Each education entry must include institution, qualification, and NQF level.': 'education-institution-0',
    }

    const fieldId = messageToFieldId[validationError]
    if (!fieldId) return

    const field = document.getElementById(fieldId)
    if (!field) return

    field.scrollIntoView({ behavior: 'smooth', block: 'center' })
    field.focus()
  }

  const handleSaveFullProfile = async () => {
    debugLog('Save button clicked')
    debugLog('  - userId:', userId)
    debugLog('  - hasSupabaseConfig:', hasSupabaseConfig)
    
    if (!userId || !hasSupabaseConfig) {
      setUploadMessage('Please sign in and ensure Supabase is configured before saving.')
      return
    }

    // Stop early if required fields are incomplete or invalid.
    const validationError = validateProfileForm()
    if (validationError) {
      debugLog('Validation error:', validationError)
      setUploadMessage(validationError)
      setEducationFieldErrors(getEducationValidationErrors(educationRows))
      const messageToFieldKey = {
        'First name is required.': 'first_name',
        'Last name is required.': 'last_name',
        'Phone number is required.': 'phone',
        'Phone number must contain 10 to 15 digits.': 'phone',
        'Location is required.': 'location',
        'ID number is required.': 'id_number',
        'ID number must be exactly 13 digits.': 'id_number',
        'Date of birth cannot be in the future.': 'date_of_birth',
      }
      const fieldKey = messageToFieldKey[validationError]
      if (fieldKey) {
        setFieldErrors((current) => ({ ...current, [fieldKey]: validationError }))
      }
      focusValidationField(validationError)
      return
    }

    debugLog('Validation passed, starting save')
    setIsSavingProfile(true)
    setUploadMessage('Saving profile...')

    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      // Map auth identity to a row in `users` so profile foreign keys stay valid.
      const databaseUserId = await resolveDatabaseUserId(authUser)
      if (!databaseUserId) {
        setUploadMessage('Could not save profile because your user account is not linked in the database.')
        setIsSavingProfile(false)
        return
      }

      // Build the payload exactly how applicant_profiles expects it.
      const profilePayload = {
        user_id: databaseUserId,
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

      // Update existing profile when we already have an id, otherwise create one.
      if (resolvedProfileId) {
        const { error: updateError } = await supabase
          .from('applicant_profiles')
          .update(profilePayload)
          .eq('id', resolvedProfileId)

        if (updateError) {
          console.error('Profile update error:', updateError)
          setUploadMessage(`Could not save profile: ${getFriendlySupabaseError(updateError, 'Unknown error')}`)
          setIsSavingProfile(false)
          return
        }
      } else {
        const { data: insertedProfile, error: insertError } = await supabase
          .from('applicant_profiles')
          .insert(profilePayload)
          .select('id')
          .single()

        if (insertError || !insertedProfile?.id) {
          console.error('Profile insert error:', insertError)
          setUploadMessage(`Could not create profile: ${getFriendlySupabaseError(insertError, 'Unknown error')}`)
          setIsSavingProfile(false)
          return
        }

        resolvedProfileId = insertedProfile.id
        setProfileId(insertedProfile.id)
      }

      // Replace child records to keep education/skills aligned with current form state.
      const [deleteEdu, deleteSkills] = await Promise.all([
        supabase.from('applicant_education').delete().eq('applicant_id', resolvedProfileId),
        supabase.from('applicant_skills').delete().eq('applicant_id', resolvedProfileId),
      ])

      if (deleteEdu.error) {
        console.error('Education delete error:', deleteEdu.error)
      }
      if (deleteSkills.error) {
        console.error('Skills delete error:', deleteSkills.error)
      }

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
          console.error('Education insert error:', educationError)
          setUploadMessage(
            `Profile saved, but education entries failed: ${getFriendlySupabaseError(educationError, 'Unknown error')}`,
          )
          setIsSavingProfile(false)
          return
        }
      }

      if (selectedSkillTagIds.length > 0) {
        const skillsPayload = selectedSkillTagIds.map((skillTagId) => ({
          applicant_id: resolvedProfileId,
          skill_tag_id: skillTagId,
        }))

        debugLog('Saving skills:', skillsPayload)
        const { error: skillsError } = await supabase.from('applicant_skills').insert(skillsPayload)
        if (skillsError) {
          console.error('Skills insert error:', skillsError)
          setUploadMessage(
            `Profile saved, but selected skills failed: ${getFriendlySupabaseError(skillsError, 'Unknown error')}`,
          )
          setIsSavingProfile(false)
          return
        }
      }

      debugLog('Profile saved with ID:', resolvedProfileId)
      debugLog('Saved profile:', profilePayload)
      debugLog('Saved education entries:', educationPayload.length)
      debugLog('Saved skills:', selectedSkillTagIds.length)

      setIsSavingProfile(false)
      setShowSavedConfirmation(true)
      setUploadMessage('')

      // Show "Saved" for 2 seconds
      setTimeout(() => {
        setShowSavedConfirmation(false)
      }, 2000)

      // Reload data to verify persistence
      debugLog('Reloading profile data to verify persistence')
      await fetchFiles(userId, databaseUserId)
    } catch (err) {
      console.error('Unexpected save error:', err)
      setUploadMessage(getFriendlySupabaseError(err, 'Unexpected error while saving profile. Please try again.'))
      setIsSavingProfile(false)
    }
  }

  const handleProfileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !userId) return

    setUploadMessage('Uploading profile picture...')

    // Store one profile picture per user by reusing the same file key.
    const extension = file.name.split('.').pop() || 'jpg'
    const filePath = `${userId}/profile.${extension}`

    const { error } = await supabase.storage.from(PROFILE_BUCKET).upload(filePath, file, { upsert: true })

    if (error) {
      setUploadMessage(`Profile upload failed: ${getFriendlySupabaseError(error, 'Please try again.')}`)
      setTimeout(() => setUploadMessage(''), 3000)
      return
    }

    setUploadMessage('Profile picture uploaded successfully.')
    setTimeout(() => setUploadMessage(''), 3000)
    await fetchStorageFiles(userId)
  }

  const handleDocumentUpload = async (event) => {
    const files = Array.from(event.target.files || [])
    if (!files.length || !userId) return

    setUploadMessage(`Uploading ${files.length} document${files.length > 1 ? 's' : ''}...`)

    // Upload each document with a timestamp prefix to avoid filename collisions.
    for (const file of files) {
      const safeName = file.name.replace(/\s+/g, '_')
      const filePath = `${userId}/${Date.now()}-${safeName}`

      const { error } = await supabase.storage.from(DOCS_BUCKET).upload(filePath, file, { upsert: false })

      if (error) {
        setUploadMessage(
          `Document upload failed for ${file.name}: ${getFriendlySupabaseError(error, 'Please try again.')}`,
        )
        setTimeout(() => setUploadMessage(''), 3000)
        event.target.value = ''
        return
      }
    }

    event.target.value = ''
    setUploadMessage('Document(s) uploaded successfully.')
    setTimeout(() => setUploadMessage(''), 3000)
    await fetchStorageFiles(userId)
  }

  const handleCvUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file || !userId) return

    // CV uploads are limited to PDF/DOC/DOCX and a small size so providers only receive supported documents.
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

    // Persist the uploaded CV path onto the applicant profile so it can be reopened later from the profile page.
    await supabase.from('applicant_profiles').update({ cv_url: filePath }).eq('user_id', userId)
    await resolveCvLink(userId, filePath)

    setUploadMessage('CV uploaded successfully.')
    setTimeout(() => setUploadMessage(''), 3000)
    await fetchStorageFiles(userId)
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

    // If the deleted file is the active CV, clear the database reference too.
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
    await fetchStorageFiles(userId)
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
    await fetchStorageFiles(userId)
  }

  const openDocument = async (fileName) => {
    if (!userId || !fileName) return

    // Signed URLs keep private storage objects secure while still viewable in-browser.
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
            <label className={`profile-field ${fieldErrors.first_name ? 'profile-field-invalid' : ''}`} htmlFor="profile-first-name">
              <span>First name</span>
              <input
                className="profile-input"
                id="profile-first-name"
                value={profileForm.first_name}
                onChange={(event) => handleProfileFieldChange('first_name', event.target.value)}
                onBlur={(event) => handleProfileFieldBlur('first_name', event.target.value)}
                aria-invalid={Boolean(fieldErrors.first_name)}
              />
              {fieldErrors.first_name ? <p className="profile-field-error">{fieldErrors.first_name}</p> : null}
            </label>

            <label className={`profile-field ${fieldErrors.last_name ? 'profile-field-invalid' : ''}`} htmlFor="profile-last-name">
              <span>Last name</span>
              <input
                className="profile-input"
                id="profile-last-name"
                value={profileForm.last_name}
                onChange={(event) => handleProfileFieldChange('last_name', event.target.value)}
                onBlur={(event) => handleProfileFieldBlur('last_name', event.target.value)}
                aria-invalid={Boolean(fieldErrors.last_name)}
              />
              {fieldErrors.last_name ? <p className="profile-field-error">{fieldErrors.last_name}</p> : null}
            </label>

            <label className={`profile-field ${fieldErrors.phone ? 'profile-field-invalid' : ''}`} htmlFor="profile-phone">
              <span>Phone</span>
              <input
                className="profile-input"
                id="profile-phone"
                inputMode="tel"
                maxLength={15}
                placeholder="e.g. 0821234567"
                value={profileForm.phone}
                onChange={(event) => handleProfileFieldChange('phone', event.target.value)}
                onBlur={(event) => handleProfileFieldBlur('phone', event.target.value)}
                aria-invalid={Boolean(fieldErrors.phone)}
              />
              {fieldErrors.phone ? <p className="profile-field-error">{fieldErrors.phone}</p> : null}
            </label>

            <label className={`profile-field ${fieldErrors.location ? 'profile-field-invalid' : ''}`} htmlFor="profile-location">
              <span>Location</span>
              <input
                className="profile-input"
                id="profile-location"
                value={profileForm.location}
                onChange={(event) => handleProfileFieldChange('location', event.target.value)}
                onBlur={(event) => handleProfileFieldBlur('location', event.target.value)}
                aria-invalid={Boolean(fieldErrors.location)}
              />
              {fieldErrors.location ? <p className="profile-field-error">{fieldErrors.location}</p> : null}
            </label>

            <label className={`profile-field ${fieldErrors.id_number ? 'profile-field-invalid' : ''}`} htmlFor="profile-id-number">
              <span>ID number</span>
              <input
                className="profile-input"
                id="profile-id-number"
                inputMode="numeric"
                maxLength={13}
                placeholder="13 digits"
                value={profileForm.id_number}
                onChange={(event) => handleProfileFieldChange('id_number', event.target.value)}
                onBlur={(event) => handleProfileFieldBlur('id_number', event.target.value)}
                aria-invalid={Boolean(fieldErrors.id_number)}
              />
              {fieldErrors.id_number ? <p className="profile-field-error">{fieldErrors.id_number}</p> : null}
            </label>

            <label className={`profile-field ${fieldErrors.date_of_birth ? 'profile-field-invalid' : ''}`} htmlFor="profile-date-of-birth">
              <span>Date of birth</span>
              <input
                className="profile-input"
                id="profile-date-of-birth"
                type="date"
                value={profileForm.date_of_birth}
                onChange={(event) => handleProfileFieldChange('date_of_birth', event.target.value)}
                onBlur={(event) => handleProfileFieldBlur('date_of_birth', event.target.value)}
                aria-invalid={Boolean(fieldErrors.date_of_birth)}
              />
              {fieldErrors.date_of_birth ? <p className="profile-field-error">{fieldErrors.date_of_birth}</p> : null}
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
                  <label
                    className={`profile-field ${educationFieldErrors[`${index}-institution`] ? 'profile-field-invalid' : ''}`}
                    htmlFor={`education-institution-${index}`}
                  >
                    <span>Institution</span>
                    <input
                      className="profile-input"
                      id={`education-institution-${index}`}
                      value={row.institution}
                      onChange={(event) => handleEducationRowChange(index, 'institution', event.target.value)}
                      aria-invalid={Boolean(educationFieldErrors[`${index}-institution`])}
                    />
                    {educationFieldErrors[`${index}-institution`] ? (
                      <p className="profile-field-error">{educationFieldErrors[`${index}-institution`]}</p>
                    ) : null}
                  </label>

                  <label
                    className={`profile-field ${educationFieldErrors[`${index}-qualification_id`] ? 'profile-field-invalid' : ''}`}
                    htmlFor={`education-qualification-${index}`}
                  >
                    <span>Qualification</span>
                    <select
                      className="profile-input"
                      id={`education-qualification-${index}`}
                      value={row.qualification_id}
                      onChange={(event) => handleEducationRowChange(index, 'qualification_id', event.target.value)}
                      aria-invalid={Boolean(educationFieldErrors[`${index}-qualification_id`])}
                    >
                      <option value="">Select qualification</option>
                      {qualificationOptions.map((qualification) => (
                        <option key={qualification.id} value={qualification.id}>
                          {qualification.title} (NQF {qualification.nqf_level})
                        </option>
                      ))}
                    </select>
                    {educationFieldErrors[`${index}-qualification_id`] ? (
                      <p className="profile-field-error">{educationFieldErrors[`${index}-qualification_id`]}</p>
                    ) : null}
                  </label>

                  <label
                    className={`profile-field ${educationFieldErrors[`${index}-nqf_level`] ? 'profile-field-invalid' : ''}`}
                    htmlFor={`education-nqf-level-${index}`}
                  >
                    <span>NQF level</span>
                    <select
                      className="profile-input"
                      id={`education-nqf-level-${index}`}
                      value={row.nqf_level}
                      onChange={(event) => handleEducationRowChange(index, 'nqf_level', event.target.value)}
                      aria-invalid={Boolean(educationFieldErrors[`${index}-nqf_level`])}
                    >
                      <option value="">Select NQF level</option>
                      {nqfLevels.map((level) => (
                        <option key={level} value={level}>
                          NQF level {level}
                        </option>
                      ))}
                    </select>
                    {educationFieldErrors[`${index}-nqf_level`] ? (
                      <p className="profile-field-error">{educationFieldErrors[`${index}-nqf_level`]}</p>
                    ) : null}
                  </label>

                  <label
                    className={`profile-field ${educationFieldErrors[`${index}-year_completed`] ? 'profile-field-invalid' : ''}`}
                    htmlFor={`education-year-${index}`}
                  >
                    <span>Year completed</span>
                    <input
                      className="profile-input"
                      id={`education-year-${index}`}
                      type="number"
                      min={1900}
                      max={new Date().getFullYear() + 1}
                      placeholder="2025"
                      value={row.year_completed}
                      onChange={(event) => handleEducationRowChange(index, 'year_completed', event.target.value)}
                      aria-invalid={Boolean(educationFieldErrors[`${index}-year_completed`])}
                    />
                    {educationFieldErrors[`${index}-year_completed`] ? (
                      <p className="profile-field-error">{educationFieldErrors[`${index}-year_completed`]}</p>
                    ) : null}
                  </label>
                </div>
              </section>
            ))}
          </div>
        </section>

        <section className="user-panel profile-card profile-card-skills">
          <h2>Skills</h2>
          <p className="user-panel-copy">
            Select skills from the comprehensive library below. Search or click "View all skills" to explore more options.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <label className="profile-field profile-search-field" htmlFor="skill-search" style={{ flex: 1, margin: 0 }}>
              <span style={{ display: 'block', marginBottom: '0.25rem' }}>Search available skills</span>
              <input
                id="skill-search"
                className="profile-input"
                value={skillSearch}
                onChange={(event) => setSkillSearch(event.target.value)}
                placeholder="Type to filter skill library"
              />
            </label>
            <button
              type="button"
              className="user-action-btn user-action-btn-inline"
              onClick={() => setShowAllSkills(!showAllSkills)}
              style={{ marginTop: '1.5rem' }}
            >
              {showAllSkills ? 'Show fewer' : 'View all skills'}
            </button>
          </div>

          <div className="skill-pill-group skill-pill-group-selected" aria-label="Selected skills">
            {allSelectedSkills.length === 0 ? (
              <p className="user-item-meta">No skills selected yet.</p>
            ) : (
              allSelectedSkills.map((skillTag) => (
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
                  onClick={() => toggleSkillSelection(skillTag.id)}
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
            {showSavedConfirmation ? '✓ Saved' : isSavingProfile ? 'Saving...' : 'Save full profile'}
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
