-- Allow providers and admins to read applicant profile images and documents.
-- Applicants retain full control over their own storage folders.

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