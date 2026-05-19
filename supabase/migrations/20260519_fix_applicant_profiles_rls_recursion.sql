-- Fix infinite recursion in applicant_profiles RLS policies.
--
-- Root cause: applicant_profiles_provider_select queries `applications`,
-- and applications_applicant_own queries `applicant_profiles` — a cycle.
--
-- Fix: replace the recursive policies with a SECURITY DEFINER function that
-- queries `applications` bypassing its own RLS, so the chain terminates.
--
-- Run this in the Supabase SQL editor.

-- Drop the policies that caused recursion
drop policy if exists "applicant_profiles_provider_select" on applicant_profiles;
drop policy if exists "applicant_education_provider_select" on applicant_education;
drop policy if exists "applicant_skills_provider_select" on applicant_skills;

-- Security definer function: checks whether the current authenticated user
-- (acting as a provider) owns a listing that this applicant has applied to.
-- SECURITY DEFINER means it runs as the function owner, bypassing RLS on
-- the tables it queries — this is what breaks the recursive cycle.
create or replace function public.provider_can_view_applicant(p_applicant_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from applications a
    join opportunities o on o.id = a.opportunity_id
    join provider_profiles pp on pp.id = o.provider_id
    join users u on u.id = pp.user_id
    where a.applicant_id = p_applicant_id
      and u.email = (select auth.jwt() ->> 'email')
  )
$$;

-- Recreate the provider-select policies using the function instead of a direct
-- subquery on applications, so no cycle can form at the SQL level.

drop policy if exists "applicant_profiles_provider_select" on applicant_profiles;
create policy "applicant_profiles_provider_select"
  on applicant_profiles
  for select
  to authenticated
  using (public.provider_can_view_applicant(id));

drop policy if exists "applicant_education_provider_select" on applicant_education;
create policy "applicant_education_provider_select"
  on applicant_education
  for select
  to authenticated
  using (public.provider_can_view_applicant(applicant_id));

drop policy if exists "applicant_skills_provider_select" on applicant_skills;
create policy "applicant_skills_provider_select"
  on applicant_skills
  for select
  to authenticated
  using (public.provider_can_view_applicant(applicant_id));
