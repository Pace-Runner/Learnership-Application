import { hasSupabaseConfig, supabase } from './lib/supabaseClient'

export function getLandingRoute(role) {
  if (role === 'Admin') return '/admin'
  if (role === 'Provider') return '/provider'
  return '/dashboard'
}

export function isProviderProfileComplete(profile) {
  return Boolean(
    profile?.id
      && profile?.organisation_name?.trim()
      && profile?.phone?.trim()
      && profile?.description?.trim(),
  )
}

export function getProviderLandingRoute(profile) {
  return isProviderProfileComplete(profile) ? '/provider' : '/provider/profile'
}

export function isApplicantProfileComplete(profile) {
  return Boolean(
    profile?.id
      && profile?.first_name?.trim()
      && profile?.last_name?.trim()
      && profile?.phone?.trim()
      && profile?.location?.trim()
      && profile?.date_of_birth
      && profile?.id_number?.trim()
      && profile?.cv_url?.trim(),
  )
}

export function getConfiguredAdminEmails() {
  const configuredEmails = import.meta.env.VITE_ADMIN_EMAILS?.trim()

  if (configuredEmails) {
    return configuredEmails
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  }

  return ['connor@yourdomain.com', 'anotheradmin@yourdomain.com']
}

export async function getRoleForEmail(email) {
  const { data: userRecord, error: fetchError } = await supabase
    .from('users')
    .select('role')
    .eq('email', email)
    .maybeSingle()

  if (fetchError) {
    throw fetchError
  }

  if (!userRecord?.role) {
    const normalizedEmail = email?.trim().toLowerCase()
    const configuredAdminEmails = getConfiguredAdminEmails()

    if (normalizedEmail && configuredAdminEmails.includes(normalizedEmail)) {
      const { data: restoredAdmin, error: restoreError } = await supabase
        .from('users')
        .upsert({ email: normalizedEmail, role: 'Admin' }, { onConflict: 'email' })
        .select('role')
        .single()

      if (restoreError) {
        throw restoreError
      }

      return restoredAdmin?.role ?? 'Admin'
    }
  }

  return userRecord?.role ?? null
}

export async function getApplicantLandingRouteForEmail(email) {
  if (!hasSupabaseConfig || !email) {
    return '/dashboard'
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (!userRow?.id) {
    return '/profile'
  }

  return '/dashboard'
}

export async function getProviderLandingRouteForEmail(email) {
  if (!hasSupabaseConfig || !email) {
    return '/provider/profile'
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (!userRow?.id) {
    return '/provider/profile'
  }

  const { data: profileRow } = await supabase
    .from('provider_profiles')
    .select('id,organisation_name,phone,description')
    .eq('user_id', userRow.id)
    .maybeSingle()

  return getProviderLandingRoute(profileRow)
}
