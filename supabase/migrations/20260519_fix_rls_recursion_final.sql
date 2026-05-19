-- CLEAN SLATE: remove all policies from affected tables and rebuild without recursion.
-- Uses CASCADE to force-remove the function and any policies that depend on it.

-- Step 1: Force-drop the function and everything that depends on it
drop function if exists public.provider_can_view_applicant(uuid) cascade;

-- Step 2: Drop every remaining policy on the four affected tables by name
drop policy if exists "applications_applicant_own"            on applications;
drop policy if exists "applications_provider_select"          on applications;
drop policy if exists "applications_provider_update"          on applications;
drop policy if exists "applicant_profiles_own"                on applicant_profiles;
-- NOTE: the actual policy in the DB was named "applicant_profiles_provider_read"
-- (not "applicant_profiles_provider_select"). That wrong name is why previous
-- migrations failed to drop it and the recursion persisted.
drop policy if exists "applicant_profiles_provider_read"      on applicant_profiles;
drop policy if exists "applicant_profiles_provider_select"    on applicant_profiles;
drop policy if exists "applicant_profiles_authenticated_read" on applicant_profiles;
drop policy if exists "applicant_education_own"               on applicant_education;
drop policy if exists "applicant_education_provider_select"   on applicant_education;
drop policy if exists "applicant_education_authenticated_read" on applicant_education;
drop policy if exists "applicant_skills_own"                  on applicant_skills;
drop policy if exists "applicant_skills_provider_select"      on applicant_skills;
drop policy if exists "applicant_skills_authenticated_read"   on applicant_skills;

-- Step 3: Rebuild applicant_profiles policies
-- Write access: only the profile owner can insert/update/delete
create policy "applicant_profiles_own"
  on applicant_profiles for all to authenticated
  using (
    exists (
      select 1 from users u
      where u.id = applicant_profiles.user_id
        and u.email = auth.jwt() ->> 'email'
    )
  )
  with check (
    exists (
      select 1 from users u
      where u.id = applicant_profiles.user_id
        and u.email = auth.jwt() ->> 'email'
    )
  );

-- Read access: any authenticated user can read profiles (providers reviewing applicants)
create policy "applicant_profiles_authenticated_read"
  on applicant_profiles for select to authenticated
  using (true);

-- Step 4: Rebuild applicant_education policies
create policy "applicant_education_own"
  on applicant_education for all to authenticated
  using (
    applicant_id in (
      select ap.id from applicant_profiles ap
      join users u on u.id = ap.user_id
      where u.email = auth.jwt() ->> 'email'
    )
  )
  with check (
    applicant_id in (
      select ap.id from applicant_profiles ap
      join users u on u.id = ap.user_id
      where u.email = auth.jwt() ->> 'email'
    )
  );

create policy "applicant_education_authenticated_read"
  on applicant_education for select to authenticated
  using (true);

-- Step 5: Rebuild applicant_skills policies
create policy "applicant_skills_own"
  on applicant_skills for all to authenticated
  using (
    applicant_id in (
      select ap.id from applicant_profiles ap
      join users u on u.id = ap.user_id
      where u.email = auth.jwt() ->> 'email'
    )
  )
  with check (
    applicant_id in (
      select ap.id from applicant_profiles ap
      join users u on u.id = ap.user_id
      where u.email = auth.jwt() ->> 'email'
    )
  );

create policy "applicant_skills_authenticated_read"
  on applicant_skills for select to authenticated
  using (true);

-- Step 6: Rebuild applications policies
-- Applicants can manage their own applications
create policy "applications_applicant_own"
  on applications for all to authenticated
  using (
    applicant_id in (
      select ap.id from applicant_profiles ap
      join users u on u.id = ap.user_id
      where u.email = auth.jwt() ->> 'email'
    )
  )
  with check (
    applicant_id in (
      select ap.id from applicant_profiles ap
      join users u on u.id = ap.user_id
      where u.email = auth.jwt() ->> 'email'
    )
  );

-- Providers can read applications for their own listings
create policy "applications_provider_select"
  on applications for select to authenticated
  using (
    opportunity_id in (
      select o.id from opportunities o
      join provider_profiles pp on pp.id = o.provider_id
      join users u on u.id = pp.user_id
      where u.email = auth.jwt() ->> 'email'
    )
  );

-- Providers can update application status for their own listings
create policy "applications_provider_update"
  on applications for update to authenticated
  using (
    opportunity_id in (
      select o.id from opportunities o
      join provider_profiles pp on pp.id = o.provider_id
      join users u on u.id = pp.user_id
      where u.email = auth.jwt() ->> 'email'
    )
  )
  with check (
    opportunity_id in (
      select o.id from opportunities o
      join provider_profiles pp on pp.id = o.provider_id
      join users u on u.id = pp.user_id
      where u.email = auth.jwt() ->> 'email'
    )
  );
