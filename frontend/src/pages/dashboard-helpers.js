// Helper functions for Dashboard component
// Separated from Dashboard.jsx to avoid react-refresh issues with exported functions

const applicationStatusLabels = {
  Received: 'Pending',
  Pending: 'Pending',
  Shortlisted: 'Reviewed',
  Offered: 'Accepted',
  Rejected: 'Rejected',
}

export function formatRandAmount(value) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return 'Not specified'
  }

  return `R${parsed.toLocaleString('en-ZA', { maximumFractionDigits: 2 })}`
}

export function formatShortDate(value) {
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

export function getApplicationStatusLabel(status) {
  return applicationStatusLabels[status] || 'Pending'
}

export function getApplicationStatusClass(status) {
  if (status === 'Pending' || status === 'Received') {
    return 'status-chip status-chip-pending'
  }

  if (status === 'Reviewed' || status === 'Shortlisted') {
    return 'status-chip status-chip-reviewed'
  }

  if (status === 'Accepted' || status === 'Offered') {
    return 'status-chip status-chip-approved'
  }

  if (status === 'Rejected') {
    return 'status-chip status-chip-removed'
  }

  return 'status-chip status-chip-pending'
}

export function formatApplicationDate(value) {
  if (!value) {
    return 'Not specified'
  }

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return parsedDate.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatNotificationDate(value) {
  if (!value) {
    return 'Not specified'
  }

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return parsedDate.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function getNotificationTypeLabel(type) {
  if (type === 'status_update') {
    return 'Application update'
  }

  if (type === 'new_opportunity') {
    return 'New opportunity'
  }

  if (type === 'closing_date') {
    return 'Closing reminder'
  }

  return 'Notification'
}

export function normalizeApplicationRow(row) {
  const opportunity = row.opportunities || row.opportunity || {}
  const applicantProfile = row.applicant_profiles || row.applicants || row.applicant || {}

  return {
    id: row.id,
    listingTitle: opportunity.title || 'Untitled opportunity',
    type: opportunity.type || 'Not specified',
    location: opportunity.location || 'Not specified',
    closingDate: opportunity.closing_date || '',
    appliedAt: row.applied_at || row.updated_at || '',
    status: getApplicationStatusLabel(row.status),
    applicantName: applicantProfile.first_name ? `${applicantProfile.first_name} ${applicantProfile.last_name || ''}`.trim() : 'Unknown',
  }
}

export function normalizeApprovedListing(row) {
  const providerProfile = row.provider_profiles || {}

  return {
    id: row.id,
    title: row.title || 'Untitled opportunity',
    type: row.type || 'Not specified',
    description: row.description || '',
    meta: row.meta,
    location: row.location || 'Not specified',
    stipend: row.stipend,
    closingDate: row.closingDate || row.closing_date || 'Not specified',
    status: row.status || 'Approved',
    provider: providerProfile.organisation_name || row.provider_name || row.provider || 'Not specified',
  }
}

export function filterApprovedListings(listings, searchTerm, selectedType) {
  const normalizedSearchTerm = searchTerm.trim().toLowerCase()

  return listings.filter((listing) => {
    // All listings must have at least a title
    if (!listing?.title) {
      return false
    }

    // Applicants should never see pending or removed opportunities in the search results.
    // (Built-in listings have no status field, so they pass this check)
    if (listing?.status && listing.status !== 'Approved') {
      return false
    }

    const title = String(listing?.title || '').toLowerCase()
    const description = String(listing?.description || '').toLowerCase()
    const listingLocation = String(listing?.location || '').toLowerCase()
    const listingType = String(listing?.type || '')

    const matchesSearch = !normalizedSearchTerm
      || title.includes(normalizedSearchTerm)
      || description.includes(normalizedSearchTerm)
      || listingLocation.includes(normalizedSearchTerm)

    const matchesType = selectedType === 'All' || listingType === selectedType

    return matchesSearch && matchesType
  })
}

export function normalizeFavouriteRow(row) {
  const opportunity = row.opportunities || row.opportunity || {}

  return {
    favouriteId: row.id,
    favouriteCreatedAt: row.created_at,
    ...normalizeApprovedListing(opportunity),
  }
}
