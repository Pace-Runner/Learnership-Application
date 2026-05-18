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
