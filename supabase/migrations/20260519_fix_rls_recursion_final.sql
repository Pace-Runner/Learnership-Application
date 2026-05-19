-- Final fix for infinite RLS recursion.
-- Drop policies first (they depend on the function), then the function, then recreate.

-- Drop the policies that reference the function (must come before dropping the function)
drop policy if exists "applicant_profiles_provider_select" on applicant_profiles;
drop policy if exists "applicant_education_provider_select" on applicant_education;
drop policy if exists "applicant_skills_provider_select" on applicant_skills;

-- Drop any leftover copies from previous attempts
drop policy if exists "applicant_profiles_authenticated_read" on applicant_profiles;
drop policy if exists "applicant_education_authenticated_read" on applicant_education;
drop policy if exists "applicant_skills_authenticated_read" on applicant_skills;

-- Now safe to drop the function
drop function if exists public.provider_can_view_applicant(uuid);

-- Allow any signed-in user to read applicant profiles, education, and skills.
-- Write access is still protected by the existing _own policies.
create policy "applicant_profiles_authenticated_read"
  on applicant_profiles
  for select
  to authenticated
  using (true);

create policy "applicant_education_authenticated_read"
  on applicant_education
  for select
  to authenticated
  using (true);

create policy "applicant_skills_authenticated_read"
  on applicant_skills
  for select
  to authenticated
  using (true);
