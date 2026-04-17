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

-- Enable RLS on skill_tags
alter table skill_tags enable row level security;

-- All authenticated users can read skill_tags (needed for dropdown/library)
drop policy if exists "skill_tags_read" on skill_tags;
create policy "skill_tags_read"
  on skill_tags
  for select
  to authenticated
  using (true);
