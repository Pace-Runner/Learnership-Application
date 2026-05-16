import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'
import './UserPages.css'

const listingTypes = ['Learnership', 'Internship', 'Apprenticeship']

const initialFormState = {
  title: '',
  type: 'Learnership',
  description: '',
  stipend: '',
  location: '',
  duration: '',
  requirements: '',
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

function formatRandAmount(value) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return 'R0'
  }

  return `R${parsed.toLocaleString('en-ZA', { maximumFractionDigits: 2 })}`
}

export default function ProviderListingEdit() {
  const navigate = useNavigate()
  const { listingId } = useParams()

  const [formValues, setFormValues] = useState(initialFormState)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingListing, setIsLoadingListing] = useState(true)
  const [listingStatus, setListingStatus] = useState('Pending')

  const minClosingDate = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadListingForEdit = async () => {
      setIsLoadingListing(true)
      setSubmitError('')

      if (!hasSupabaseConfig) {
        if (isMounted) {
          setSubmitError('Supabase is not configured. Listing edit requires database access.')
          setIsLoadingListing(false)
        }
        return
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      const email = sessionData?.session?.user?.email

      if (sessionError || !email) {
        if (isMounted) {
          setSubmitError('You must be signed in as a Provider to edit a listing.')
          setIsLoadingListing(false)
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
          setSubmitError('Provider account details were not found.')
          setIsLoadingListing(false)
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
          setSubmitError('Provider profile was not found.')
          setIsLoadingListing(false)
        }
        return
      }

      const { data: listingRow, error: listingError } = await supabase
        .from('opportunities')
        .select('id,title,type,description,stipend,location,duration,closing_date,status')
        .eq('id', listingId)
        .eq('provider_id', providerRow.id)
        .maybeSingle()

      if (listingError || !listingRow) {
        if (isMounted) {
          setSubmitError('Listing not found or you do not have permission to edit it.')
          setIsLoadingListing(false)
        }
        return
      }

      const { data: requirementRow, error: requirementError } = await supabase
        .from('opportunity_requirements')
        .select('id,description')
        .eq('opportunity_id', listingRow.id)
        .maybeSingle()

      if (requirementError && requirementError.code !== 'PGRST116') {
        if (isMounted) {
          setSubmitError('Listing requirements could not be loaded.')
          setIsLoadingListing(false)
        }
        return
      }

      if (isMounted) {
        setListingStatus(listingRow.status || 'Pending')
        setFormValues({
          title: listingRow.title || '',
          type: listingRow.type || 'Learnership',
          description: listingRow.description || '',
          stipend: listingRow.stipend != null ? String(listingRow.stipend) : '',
          location: listingRow.location || '',
          duration: listingRow.duration || '',
          requirements: requirementRow?.description || '',
          closing_date: listingRow.closing_date || '',
        })
        setIsLoadingListing(false)
      }
    }

    loadListingForEdit()

    return () => {
      isMounted = false
    }
  }, [listingId])

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

    if (listingStatus === 'Approved') {
      const isConfirmed = window.confirm(
        'This listing is already approved. Are you sure you want to edit it?',
      )

      if (!isConfirmed) {
        return
      }
    }

    if (!hasSupabaseConfig) {
      setSubmitError('Supabase is not configured. Listing edit requires database access.')
      return
    }

    setIsSubmitting(true)

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    const email = sessionData?.session?.user?.email

    if (sessionError || !email) {
      setIsSubmitting(false)
      setSubmitError('You must be signed in as a Provider to edit a listing.')
      return
    }

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

    if (providerError || !providerRow?.id) {
      setIsSubmitting(false)
      setSubmitError('Provider profile was not found.')
      return
    }

    const { error: updateOpportunityError } = await supabase
      .from('opportunities')
      .update({
        title: formValues.title.trim(),
        type: formValues.type,
        description: formValues.description.trim(),
        stipend: Number(formValues.stipend),
        location: formValues.location.trim(),
        duration: formValues.duration.trim(),
        closing_date: formValues.closing_date,
      })
      .eq('id', listingId)
      .eq('provider_id', providerRow.id)

    if (updateOpportunityError) {
      setIsSubmitting(false)
      setSubmitError('Listing could not be updated. Please try again.')
      return
    }

    const { data: requirementRow, error: requirementLookupError } = await supabase
      .from('opportunity_requirements')
      .select('id')
      .eq('opportunity_id', listingId)
      .maybeSingle()

    if (requirementLookupError && requirementLookupError.code !== 'PGRST116') {
      setIsSubmitting(false)
      setSubmitError('Listing requirements could not be updated.')
      return
    }

    if (requirementRow?.id) {
      const { error: updateRequirementError } = await supabase
        .from('opportunity_requirements')
        .update({ description: formValues.requirements.trim() })
        .eq('id', requirementRow.id)

      if (updateRequirementError) {
        setIsSubmitting(false)
        setSubmitError('Listing requirements could not be updated.')
        return
      }
    } else {
      const { error: insertRequirementError } = await supabase.from('opportunity_requirements').insert({
        opportunity_id: listingId,
        description: formValues.requirements.trim(),
      })

      if (insertRequirementError) {
        setIsSubmitting(false)
        setSubmitError('Listing requirements could not be updated.')
        return
      }
    }

    setIsSubmitting(false)
    navigate('/provider', { replace: true })
  }

  if (isLoadingListing) {
    return (
      <main className="user-page provider-theme provider-shell">
        <section className="user-page-inner">
          <section className="user-panel provider-form-panel">
            <p className="user-panel-copy">Loading listing for edit...</p>
          </section>
        </section>
      </main>
    )
  }

  return (
    <main className="user-page provider-theme provider-shell">
      <section className="user-page-inner">
        <header className="user-hero provider-hero">
          <section>
            <p className="user-kicker">Provider Workspace</p>
            <h1>Edit listing</h1>
            <p className="user-intro">
              Update listing details and keep your opportunity information accurate for applicants.
            </p>
          </section>

          <nav className="user-nav-actions" aria-label="Provider listing navigation">
            <Link to="/provider" className="user-link-btn">
              Back to Dashboard
            </Link>
          </nav>
        </header>

        <section className="user-panel provider-form-panel">
          <h2>Edit details</h2>
          {listingStatus === 'Approved' ? (
            <p className="provider-submit-error">
              This listing is approved. Editing it will require confirmation before saving.
            </p>
          ) : null}

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
              {isSubmitting ? 'Saving...' : 'Save changes'}
            </button>
          </form>
        </section>
      </section>
    </main>
  )
}

// Export helpers for unit testing
export { validateForm, formatRandAmount }
