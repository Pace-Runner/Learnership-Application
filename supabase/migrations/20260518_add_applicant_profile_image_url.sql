-- Add profile_image_url to applicant_profiles so apps can store public URLs for provider consumption
ALTER TABLE public.applicant_profiles
  ADD COLUMN IF NOT EXISTS profile_image_url text;

-- Backfill: attempt to populate from storage public URLs where possible (best-effort; no rollback)
-- NOTE: This block is informational; run manually if desired.
-- SELECT id, user_id, (storage.get_public_url('profile-images', concat(user_id::text,'/profile.jpg'))).public_url
-- FROM public.applicant_profiles
-- WHERE profile_image_url IS NULL;
