-- Enable UUID generation in Supabase Postgres
create extension if not exists pgcrypto;

-- Chunk 1: Users & Auth
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  role text check (role in ('Applicant', 'Provider', 'Admin')) not null default 'Applicant',
  created_at timestamp default now()
);

-- Chunk 2: Profiles
create table if not exists applicant_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  location text,
  date_of_birth date,
  id_number text,
  cv_url text,
  about_me text,
  created_at timestamp default now()
);

create table if not exists provider_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  organisation_name text,
  seta_accreditation_number text,
  contact_email text,
  phone text,
  location text,
  created_at timestamp default now()
);

-- Chunk 3: NQF & Skills
create table if not exists nqf_qualifications (
  id uuid primary key default gen_random_uuid(),
  saqa_id text unique,
  title text not null,
  nqf_level int check (nqf_level between 1 and 10),
  field_of_study text,
  credits int
);

create table if not exists skill_tags (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  nqf_aligned boolean default false
);

-- Chunk 4: Applicant Education & Skills
create table if not exists applicant_education (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid references applicant_profiles(id) on delete cascade,
  institution text,
  qualification_id uuid references nqf_qualifications(id),
  nqf_level int,
  year_completed int
);

create table if not exists applicant_skills (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid references applicant_profiles(id) on delete cascade,
  skill_tag_id uuid references skill_tags(id)
);

-- Chunk 5: Opportunities
create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references provider_profiles(id) on delete cascade,
  title text not null,
  type text check (type in ('Learnership', 'Internship', 'Apprenticeship')),
  description text,
  stipend numeric,
  location text,
  duration text,
  closing_date date,
  status text check (status in ('Pending', 'Approved', 'Removed')) default 'Pending',
  created_at timestamp default now()
);

create table if not exists opportunity_requirements (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references opportunities(id) on delete cascade,
  nqf_level_required int,
  description text
);

create table if not exists opportunity_skills (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references opportunities(id) on delete cascade,
  skill_tag_id uuid references skill_tags(id)
);

-- Chunk 6: Applications
create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid references applicant_profiles(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete cascade,
  status text check (status in ('Pending', 'Shortlisted', 'Rejected', 'Offered')) default 'Pending',
  applied_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists favourites (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references applicant_profiles(id) on delete cascade,
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  created_at timestamp default now()
);

-- Chunk 7: Notifications & Logs
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  type text check (type in ('status_update', 'new_opportunity', 'closing_date')),
  message text,
  read boolean default false,
  created_at timestamp default now()
);

create table if not exists email_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  subject text,
  sent_at timestamp default now(),
  status text check (status in ('sent', 'failed'))
);

-- Chunk 8: Admin Actions
create table if not exists admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references users(id),
  action_type text check (action_type in ('approved', 'removed', 'deleted', 'account_deleted')),
  target_type text check (target_type in ('listing', 'user', 'applicant', 'provider', 'admin')),
  target_id uuid,
  listing_type text,
  reason text,
  created_at timestamp default now()
);

-- Chunk 9: Seed admin emails
insert into users (email, role) values
  ('connor@yourdomain.com', 'Admin'),
  ('anotheradmin@yourdomain.com', 'Admin')
on conflict (email) do update set role = excluded.role;






-- Supabase Storage setup for applicant uploads
-- Run this in Supabase SQL Editor after schema.sql and rls.sql

-- 1) Create private buckets (if they do not already exist)
insert into storage.buckets (id, name, public)
values
  ('profile-images', 'profile-images', false),
  ('applicant-documents', 'applicant-documents', false)
on conflict (id) do nothing;

-- 2) Profile image policies (owners manage their folder; providers/admins can view applicant uploads)
drop policy if exists "profile_images_select_own" on storage.objects;
create policy "profile_images_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1
        from users u
        where u.email = auth.jwt() ->> 'email'
          and u.role in ('Provider', 'Admin')
      )
    )
  );

drop policy if exists "profile_images_insert_own" on storage.objects;
create policy "profile_images_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "profile_images_update_own" on storage.objects;
create policy "profile_images_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "profile_images_delete_own" on storage.objects;
create policy "profile_images_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3) Applicant document policies (owners manage their folder; providers/admins can view applicant uploads)
drop policy if exists "applicant_docs_select_own" on storage.objects;
create policy "applicant_docs_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'applicant-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1
        from users u
        where u.email = auth.jwt() ->> 'email'
          and u.role in ('Provider', 'Admin')
      )
    )
  );

drop policy if exists "applicant_docs_insert_own" on storage.objects;
create policy "applicant_docs_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'applicant-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "applicant_docs_update_own" on storage.objects;
create policy "applicant_docs_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'applicant-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'applicant-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "applicant_docs_delete_own" on storage.objects;
create policy "applicant_docs_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'applicant-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
