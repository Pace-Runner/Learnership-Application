-- Allow public reads for applicant profile images and documents.
-- Applicants retain full control over their own storage folders.

drop policy if exists "profile_images_select_own" on storage.objects;
create policy "profile_images_select_own"
  on storage.objects
  for select
  to public
  using (bucket_id = 'profile-images');

drop policy if exists "applicant_docs_select_own" on storage.objects;
create policy "applicant_docs_select_own"
  on storage.objects
  for select
  to public
  using (bucket_id = 'applicant-documents');