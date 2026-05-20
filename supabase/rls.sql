-- Run this only if you plan to enable RLS on users table.

alter table users enable row level security;

-- Authenticated users can read only their own row.
drop policy if exists "users_select_own" on users;
create policy "users_select_own"
  on users
  for select
  to authenticated
  using (email = auth.jwt() ->> 'email');

-- Authenticated users can insert only their own row.
drop policy if exists "users_insert_own" on users;
create policy "users_insert_own"
  on users
  for insert
  to authenticated
  with check (email = auth.jwt() ->> 'email');

-- Authenticated users can update only their own row.
drop policy if exists "users_update_own" on users;
create policy "users_update_own"
  on users
  for update
  to authenticated
  using (email = auth.jwt() ->> 'email')
  with check (email = auth.jwt() ->> 'email');

-- Enable RLS on applicant_profiles
alter table applicant_profiles enable row level security;

-- Users can read/write their own applicant profile
drop policy if exists "applicant_profiles_own" on applicant_profiles;
create policy "applicant_profiles_own"
  on applicant_profiles
  for all
  to authenticated
  using (
    exists (
      select 1
      from users u
      where u.id = applicant_profiles.user_id
        and u.email = auth.jwt() ->> 'email'
    )
  )
  with check (
    exists (
      select 1
      from users u
      where u.id = applicant_profiles.user_id
        and u.email = auth.jwt() ->> 'email'
    )
  );

-- Enable RLS on opportunities
alter table opportunities enable row level security;

-- Applicants can read approved listings, providers can manage their own listings, and admins can read everything.
drop policy if exists "opportunities_select_access" on opportunities;
create policy "opportunities_select_access"
  on opportunities
  for select
  to authenticated
  using (
    status = 'Approved'
    or exists (
      select 1
      from provider_profiles pp
      join users u on u.id = pp.user_id
      where pp.id = opportunities.provider_id
        and u.email = auth.jwt() ->> 'email'
    )
    or exists (
      select 1
      from users u
      where u.email = auth.jwt() ->> 'email'
        and u.role = 'Admin'
    )
  );

drop policy if exists "opportunities_manage_own" on opportunities;
create policy "opportunities_manage_own"
  on opportunities
  for all
  to authenticated
  using (
    exists (
      select 1
      from provider_profiles pp
      join users u on u.id = pp.user_id
      where pp.id = opportunities.provider_id
        and u.email = auth.jwt() ->> 'email'
    )
    or exists (
      select 1
      from users u
      where u.email = auth.jwt() ->> 'email'
        and u.role = 'Admin'
    )
  )
  with check (
    exists (
      select 1
      from provider_profiles pp
      join users u on u.id = pp.user_id
      where pp.id = opportunities.provider_id
        and u.email = auth.jwt() ->> 'email'
    )
    or exists (
      select 1
      from users u
      where u.email = auth.jwt() ->> 'email'
        and u.role = 'Admin'
    )
  );

-- Enable RLS on applicant_education
alter table applicant_education enable row level security;

-- Users can read/write education for their own profile
drop policy if exists "applicant_education_own" on applicant_education;
create policy "applicant_education_own"
  on applicant_education
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

-- Enable RLS on applicant_skills
alter table applicant_skills enable row level security;

-- Users can read/write skills for their own profile
drop policy if exists "applicant_skills_own" on applicant_skills;
create policy "applicant_skills_own"
  on applicant_skills
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

-- Enable RLS on applications
alter table applications enable row level security;

-- Applicants can read their own applications; providers can read and manage applications for their own listings; admins can read everything.
drop policy if exists "applications_select_access" on applications;
create policy "applications_select_access"
  on applications
  for select
  to authenticated
  using (
    applicant_id in (
      select ap.id
      from applicant_profiles ap
      join users u on u.id = ap.user_id
      where u.email = auth.jwt() ->> 'email'
    )
    or exists (
      select 1
      from opportunities o
      join provider_profiles pp on pp.id = o.provider_id
      join users u on u.id = pp.user_id
      where o.id = applications.opportunity_id
        and u.email = auth.jwt() ->> 'email'
    )
    or exists (
      select 1
      from users u
      where u.email = auth.jwt() ->> 'email'
        and u.role = 'Admin'
    )
  );

drop policy if exists "applications_insert_own" on applications;
create policy "applications_insert_own"
  on applications
  for insert
  to authenticated
  with check (
    applicant_id in (
      select ap.id
      from applicant_profiles ap
      join users u on u.id = ap.user_id
      where u.email = auth.jwt() ->> 'email'
    )
    and exists (
      select 1
      from opportunities o
      where o.id = applications.opportunity_id
        and o.status = 'Approved'
    )
  );

drop policy if exists "applications_manage_provider" on applications;
create policy "applications_manage_provider"
  on applications
  for update
  to authenticated
  using (
    exists (
      select 1
      from opportunities o
      join provider_profiles pp on pp.id = o.provider_id
      join users u on u.id = pp.user_id
      where o.id = applications.opportunity_id
        and u.email = auth.jwt() ->> 'email'
    )
    or exists (
      select 1
      from users u
      where u.email = auth.jwt() ->> 'email'
        and u.role = 'Admin'
    )
  )
  with check (
    exists (
      select 1
      from opportunities o
      join provider_profiles pp on pp.id = o.provider_id
      join users u on u.id = pp.user_id
      where o.id = applications.opportunity_id
        and u.email = auth.jwt() ->> 'email'
    )
    or exists (
      select 1
      from users u
      where u.email = auth.jwt() ->> 'email'
        and u.role = 'Admin'
    )
  );

drop policy if exists "applications_delete_provider" on applications;
create policy "applications_delete_provider"
  on applications
  for delete
  to authenticated
  using (
    exists (
      select 1
      from opportunities o
      join provider_profiles pp on pp.id = o.provider_id
      join users u on u.id = pp.user_id
      where o.id = applications.opportunity_id
        and u.email = auth.jwt() ->> 'email'
    )
    or exists (
      select 1
      from users u
      where u.email = auth.jwt() ->> 'email'
        and u.role = 'Admin'
    )
  );

-- Enable RLS on favourites
alter table favourites enable row level security;

-- Applicants can save and remove only their own favourite listings.
drop policy if exists "favourites_own" on favourites;
create policy "favourites_own"
  on favourites
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

-- Enable RLS on skill_tags
alter table skill_tags enable row level security;

-- All authenticated users can read skill_tags (needed for dropdown/library)
drop policy if exists "skill_tags_read" on skill_tags;
create policy "skill_tags_read"
  on skill_tags
  for select
  to authenticated
  using (true);

-- Allow authenticated users to insert new skill tags (needed for suggested/custom skills)
drop policy if exists "skill_tags_insert_authenticated" on skill_tags;
create policy "skill_tags_insert_authenticated"
  on skill_tags
  for insert
  to authenticated
  with check (true);

-- Enable RLS on notifications
alter table notifications enable row level security;

-- Applicants can read only their own notifications
drop policy if exists "notifications_select_own" on notifications;
create policy "notifications_select_own"
  on notifications
  for select
  to authenticated
  using (
    exists (
      select 1
      from users u
      where u.id = notifications.user_id
        and u.email = auth.jwt() ->> 'email'
    )
  );

-- Applicants can mark only their own notifications as read
drop policy if exists "notifications_update_own" on notifications;
create policy "notifications_update_own"
  on notifications
  for update
  to authenticated
  using (
    exists (
      select 1
      from users u
      where u.id = notifications.user_id
        and u.email = auth.jwt() ->> 'email'
    )
  )
  with check (
    exists (
      select 1
      from users u
      where u.id = notifications.user_id
        and u.email = auth.jwt() ->> 'email'
    )
  );

-- Providers currently insert status-update notifications from the client-side flow.
drop policy if exists "notifications_insert_authenticated" on notifications;
create policy "notifications_insert_authenticated"
  on notifications
  for insert
  to authenticated
  with check (true);
