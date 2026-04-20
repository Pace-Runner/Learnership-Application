import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'
import './UserPages.css'

const listingTypes = ['Learnership', 'Internship', 'Apprenticeship']

function formatRandAmount(value) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return 'R0'
  }

  return `R${parsed.toLocaleString('en-ZA', { maximumFractionDigits: 2 })}`
}

const initialFormState = {
  title: '',
  type: 'Learnership',
  description: '',
  stipend: '',
  location: '',
  duration: '',
  requirements: '',
  qualification_id: '',
  nqf_level_required: '',
  closing_date: '',
}

function validateForm(formValues, minDate) {
  const nextErrors = {}

  if (!formValues.title.trim()) nextErrors.title = 'Title is required.'
  if (!listingTypes.includes(formValues.type)) nextErrors.type = 'Select a valid listing type.'
  if (!formValues.description.trim()) nextErrors.description = 'Description is required.'
  if (!formValues.location.trim()) nextErrors.location = 'Location is required.'
  if (!formValues.duration.trim()) nextErrors.duration = 'Duration is required.'
  if (!formValues.requirements.trim()) nextErrors.requirements = 'Requirements are required.'
  if (!formValues.qualification_id) nextErrors.qualification_id = 'Qualification is required.'
  if (!formValues.nqf_level_required) {
    nextErrors.nqf_level_required = 'NQF level is required.'
  }
  if (!formValues.closing_date) {
    nextErrors.closing_date = 'Closing date is required.'
  } else if (formValues.closing_date < minDate) {
    nextErrors.closing_date = 'Closing date cannot be in the past.'
  }

  const stipendValue = Number(formValues.stipend)
  if (!formValues.stipend.trim()) {
    nextErrors.stipend = 'Stipend is required.'
  } else if (!Number.isFinite(stipendValue) || stipendValue <= 0) {
    nextErrors.stipend = 'Stipend must be a positive number.'
  }

  return nextErrors
}

export default function ProviderListingForm() {
  const navigate = useNavigate()
  const [formValues, setFormValues] = useState(initialFormState)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [qualificationOptions, setQualificationOptions] = useState([])
  const [isLoadingQualifications, setIsLoadingQualifications] = useState(true)
  const [qualificationError, setQualificationError] = useState('')

  const minClosingDate = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setQualificationOptions([])
      setIsLoadingQualifications(false)
      setQualificationError('Supabase is not configured for qualification loading.')
      return
    }

    // Reuse the same qualification source as the applicant flow so provider requirements stay aligned to NQF data.
    let isMounted = true
    setIsLoadingQualifications(true)
    setQualificationError('')

    supabase
      .from('nqf_qualifications')
      .select('id,title,nqf_level,saqa_id')
      .order('nqf_level', { ascending: true })
      .then(({ data, error }) => {
        if (!isMounted) {
          return
        }

        if (error) {
          setQualificationOptions([])
          setQualificationError('Qualification options could not be loaded.')
          setIsLoadingQualifications(false)
          return
        }

        setQualificationOptions(data || [])
        setIsLoadingQualifications(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target

    setFormValues((current) => ({
      ...current,
      [name]: value,
    }))

    setErrors((current) => {
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
    setSubmitError('')

    const nextErrors = validateForm(formValues, minClosingDate)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    if (!hasSupabaseConfig) {
      setSubmitError('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
      return
    }

    setIsSubmitting(true)

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    const email = sessionData?.session?.user?.email

    if (sessionError || !email) {
      setIsSubmitting(false)
      setSubmitError('You must be signed in as a Provider to post a listing.')
      return
    }

    // Each listing is tied to the signed-in provider profile before the opportunity row is created.
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (userError || !userRow?.id) {
      setIsSubmitting(false)
      setSubmitError('Provider account details were not found.')
      return
    }

    const { data: providerRow, error: providerError } = await supabase
      .from('provider_profiles')
      .select('id')
      .eq('user_id', userRow.id)
      .maybeSingle()

    if (providerError) {
      setIsSubmitting(false)
      setSubmitError('Provider profile was not found. Please contact support.')
      return
    }

    let providerId = providerRow?.id

    if (!providerId) {
      const { data: createdProvider, error: createProviderError } = await supabase
        .from('provider_profiles')
        .insert({
          user_id: userRow.id,
          organisation_name: 'New Provider Organisation',
          contact_email: email,
        })
        .select('id')
        .single()

      if (createProviderError || !createdProvider?.id) {
        setIsSubmitting(false)
        setSubmitError('Provider profile could not be created. Please try again.')
        return
      }

      providerId = createdProvider.id
    }

    // New provider listings always start as Pending so the admin moderation flow can approve them later.
    const { data: opportunityRow, error: opportunityError } = await supabase
      .from('opportunities')
      .insert({
        provider_id: providerId,
        title: formValues.title.trim(),
        type: formValues.type,
        description: formValues.description.trim(),
        stipend: Number(formValues.stipend),
        location: formValues.location.trim(),
        duration: formValues.duration.trim(),
        closing_date: formValues.closing_date,
        status: 'Pending',
      })
      .select('id')
      .single()

    if (opportunityError || !opportunityRow?.id) {
      setIsSubmitting(false)
      setSubmitError('Listing could not be created. Please try again.')
      return
    }

    // If saving the linked requirement fails, remove the parent listing so the database is not left half-saved.
    const { error: requirementsError } = await supabase.from('opportunity_requirements').insert({
      opportunity_id: opportunityRow.id,
      description: formValues.requirements.trim(),
      nqf_level_required: Number(formValues.nqf_level_required),
    })


    if (requirementsError) {
      await supabase.from('opportunities').delete().eq('id', opportunityRow.id)
      setIsSubmitting(false)
      setSubmitError('Listing requirements could not be saved. Please submit again.')
      return
    }

    setIsSubmitting(false)
    navigate('/provider', { replace: true })
  }

  return (
    <main className="user-page provider-theme provider-shell">
      <section className="user-page-inner">
        <header className="user-hero provider-hero">
          <section>
            <p className="user-kicker">Provider Workspace</p>
            <h1>Create a listing</h1>
            <p className="user-intro">
              Submit a learnership, internship, or apprenticeship listing for admin approval.
            </p>
          </section>

          <nav className="user-nav-actions" aria-label="Provider listing navigation">
            <Link to="/provider" className="user-link-btn">
              Back to Dashboard
            </Link>
          </nav>
        </header>

        <section className="user-panel provider-form-panel">
          <h2>Listing details</h2>
          <form className="provider-listing-form" onSubmit={handleSubmit} noValidate>
            <label htmlFor="listing-title">Title</label>
            <input
              id="listing-title"
              name="title"
              value={formValues.title}
              onChange={handleChange}
              aria-invalid={Boolean(errors.title)}
            />
            {errors.title ? <small className="provider-field-error">{errors.title}</small> : null}

            <label htmlFor="listing-type">Type</label>
            <select
              id="listing-type"
              name="type"
              value={formValues.type}
              onChange={handleChange}
              aria-invalid={Boolean(errors.type)}
            >
              {listingTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            {errors.type ? <small className="provider-field-error">{errors.type}</small> : null}

            <label htmlFor="listing-description">Description</label>
            <textarea
              id="listing-description"
              name="description"
              value={formValues.description}
              onChange={handleChange}
              rows={4}
              aria-invalid={Boolean(errors.description)}
            />
            {errors.description ? <small className="provider-field-error">{errors.description}</small> : null}

            <label htmlFor="listing-stipend">Stipend</label>
            <div className="provider-money-input-wrap">
              <span className="provider-money-prefix" aria-hidden="true">R</span>
              <input
                id="listing-stipend"
                name="stipend"
                type="number"
                min="0"
                step="0.01"
                value={formValues.stipend}
                onChange={handleChange}
                aria-invalid={Boolean(errors.stipend)}
                aria-label="Stipend amount in Rand"
                placeholder="4500"
              />
            </div>
            {formValues.stipend ? (
              <small className="provider-money-hint">Stipend preview: {formatRandAmount(formValues.stipend)}</small>
            ) : null}
            {errors.stipend ? <small className="provider-field-error">{errors.stipend}</small> : null}

            <label htmlFor="listing-location">Location</label>
            <input
              id="listing-location"
              name="location"
              value={formValues.location}
              onChange={handleChange}
              aria-invalid={Boolean(errors.location)}
            />
            {errors.location ? <small className="provider-field-error">{errors.location}</small> : null}

            <label htmlFor="listing-duration">Duration</label>
            <input
              id="listing-duration"
              name="duration"
              value={formValues.duration}
              onChange={handleChange}
              aria-invalid={Boolean(errors.duration)}
            />
            {errors.duration ? <small className="provider-field-error">{errors.duration}</small> : null}

            <label htmlFor="listing-qualification">Qualification</label>
            {isLoadingQualifications ? (
              <small className="provider-money-hint">Loading qualification options...</small>
            ) : null}
            {qualificationError ? <small className="provider-field-error">{qualificationError}</small> : null}
            <select
              id="listing-qualification"
              name="qualification_id"
              value={formValues.qualification_id}
              onChange={handleChange}
              aria-invalid={Boolean(errors.qualification_id)}
            >
              <option value="">Select qualification</option>
              {qualificationOptions.map((qualification) => (
                <option key={qualification.id} value={qualification.id}>
                  {qualification.title} (NQF {qualification.nqf_level})
                </option>
              ))}
            </select>
            {errors.qualification_id ? <small className="provider-field-error">{errors.qualification_id}</small> : null}

            <label htmlFor="listing-nqf-level">NQF level required</label>
            <select
              id="listing-nqf-level"
              name="nqf_level_required"
              value={formValues.nqf_level_required}
              onChange={handleChange}
              aria-invalid={Boolean(errors.nqf_level_required)}
            >
              <option value="">Select NQF level</option>
              {Array.from({ length: 10 }, (_, index) => index + 1).map((level) => (
                <option key={level} value={String(level)}>
                  NQF level {level}
                </option>
              ))}
            </select>
            {errors.nqf_level_required ? <small className="provider-field-error">{errors.nqf_level_required}</small> : null}

            <label htmlFor="listing-requirements">Requirements</label>
            <textarea
              id="listing-requirements"
              name="requirements"
              value={formValues.requirements}
              onChange={handleChange}
              rows={3}
              aria-invalid={Boolean(errors.requirements)}
            />
            {errors.requirements ? <small className="provider-field-error">{errors.requirements}</small> : null}

            <label htmlFor="listing-closing-date">Closing date</label>
            <input
              id="listing-closing-date"
              name="closing_date"
              type="date"
              min={minClosingDate}
              value={formValues.closing_date}
              onChange={handleChange}
              aria-invalid={Boolean(errors.closing_date)}
            />
            {errors.closing_date ? (
              <small className="provider-field-error">{errors.closing_date}</small>
            ) : null}

            {submitError ? <p className="provider-submit-error">{submitError}</p> : null}

            <button type="submit" className="user-action-btn provider-submit-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit listing'}
            </button>
          </form>
        </section>
      </section>
    </main>
  )
}
