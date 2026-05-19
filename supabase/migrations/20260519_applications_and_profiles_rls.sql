-- Enable RLS on applications and add policies for applicants and providers.
-- Also add a policy so providers can read applicant profiles for their listings.
-- Run this in the Supabase SQL editor.

-- ── applications ────────────────────────────────────────────────────────────

alter table applications enable row level security;

-- Applicants can insert and read their own applications.
drop policy if exists "applications_applicant_own" on applications;
create policy "applications_applicant_own"
  on applications
  for all
  to authenticated
  using (
    applicant_id in (
      select ap.id
      from applicant_profiles ap
      join users u on u.id = ap.user_id
      where u.email = auth.jwt() ->> 'email'
    )
  )
  with check (
    applicant_id in (
      select ap.id
      from applicant_profiles ap
      join users u on u.id = ap.user_id
      where u.email = auth.jwt() ->> 'email'
    )
  );

-- Providers can read applications for listings they own.
drop policy if exists "applications_provider_select" on applications;
create policy "applications_provider_select"
  on applications
  for select
  to authenticated
  using (
    opportunity_id in (
      select o.id
      from opportunities o
      join provider_profiles pp on pp.id = o.provider_id
      join users u on u.id = pp.user_id
      where u.email = auth.jwt() ->> 'email'
    )
  );

-- Providers can update application status for listings they own.
drop policy if exists "applications_provider_update" on applications;
create policy "applications_provider_update"
  on applications
  for update
  to authenticated
  using (
    opportunity_id in (
      select o.id
      from opportunities o
      join provider_profiles pp on pp.id = o.provider_id
      join users u on u.id = pp.user_id
      where u.email = auth.jwt() ->> 'email'
    )
  )
  with check (
    opportunity_id in (
      select o.id
      from opportunities o
      join provider_profiles pp on pp.id = o.provider_id
      join users u on u.id = pp.user_id
      where u.email = auth.jwt() ->> 'email'
    )
  );

-- ── applicant_profiles (provider read) ──────────────────────────────────────

-- Providers need to read applicant profiles for applicants who applied to their listings.
drop policy if exists "applicant_profiles_provider_select" on applicant_profiles;
create policy "applicant_profiles_provider_select"
  on applicant_profiles
  for select
  to authenticated
  using (
    id in (
      select a.applicant_id
      from applications a
      join opportunities o on o.id = a.opportunity_id
      join provider_profiles pp on pp.id = o.provider_id
      join users u on u.id = pp.user_id
      where u.email = auth.jwt() ->> 'email'
    )
  );

-- ── applicant_education (provider read) ─────────────────────────────────────

-- Providers need to read education records for applicants who applied to their listings.
drop policy if exists "applicant_education_provider_select" on applicant_education;
create policy "applicant_education_provider_select"
  on applicant_education
  for select
  to authenticated
  using (
    applicant_id in (
      select a.applicant_id
      from applications a
      join opportunities o on o.id = a.opportunity_id
      join provider_profiles pp on pp.id = o.provider_id
      join users u on u.id = pp.user_id
      where u.email = auth.jwt() ->> 'email'
    )
  );

-- ── applicant_skills (provider read) ────────────────────────────────────────

-- Providers need to read skill records for applicants who applied to their listings.
drop policy if exists "applicant_skills_provider_select" on applicant_skills;
create policy "applicant_skills_provider_select"
  on applicant_skills
  for select
  to authenticated
  using (
    applicant_id in (
      select a.applicant_id
      from applications a
      join opportunities o on o.id = a.opportunity_id
      join provider_profiles pp on pp.id = o.provider_id
      join users u on u.id = pp.user_id
      where u.email = auth.jwt() ->> 'email'
    )
  );
