# Learnership Application Portal

A role-based learnership platform built with React, Vite, and Supabase.

This project supports three core user roles:
- Applicant
- Provider
- Admin

Applicants can discover and apply for opportunities, providers can manage listings, and admins can moderate platform content.

## What This Project Demonstrates

- Supabase-backed authentication with Google OAuth.
- Supabase Postgres schema for users, profiles, opportunities, applications, and moderation.
- Role-based route protection in the frontend.
- Automated admin/auth regression tests.
- CI test execution on every push and pull request via GitHub Actions.

## Tech Stack

- Frontend: React + Vite
- Routing: react-router-dom
- Backend services: Supabase (Auth + Postgres)
- Testing: Vitest + Testing Library
- CI: GitHub Actions

## Project Structure

```text
frontend/
	src/
		App.jsx
		App.test.jsx
		pages/
		lib/supabaseClient.js
supabase/
	schema.sql
	rls.sql
.github/workflows/
	ci.yml
```

## Supabase Database Setup

1. Create a Supabase project.
2. Open SQL Editor in Supabase.
3. Run `supabase/schema.sql` to create all core tables.
4. Optional: run `supabase/rls.sql` if you want row-level security policies on `users`.
5. Update seeded admin emails in `supabase/schema.sql` to your real admin Google accounts.

### Included schema areas

- `users` (role mapping by email)
- `applicant_profiles`, `provider_profiles`
- `nqf_qualifications`, `skill_tags`
- `opportunities`, `applications`
- `notifications`, `email_logs`
- `admin_actions`

## Environment Variables

Create `frontend/.env`:

```env
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Run Locally

```bash
cd frontend
npm install
npm run dev
```

## Test Coverage and CI

The project includes admin/auth behavior tests in:
- `frontend/src/App.test.jsx`

These tests cover critical flows such as:
- Unauthorized `/admin` access redirect behavior
- Wrong-role redirect handling
- Admin role assignment by seeded email
- Non-admin role assignment safeguards
- Admin dashboard visibility
- Session persistence and logout behavior
- Moderation UI controls rendering

### Run tests locally

```bash
cd frontend
npm test
```

### See tests in GitHub Actions

1. Push your branch to GitHub.
2. Open the Actions tab in your repository.
3. Open the latest `CI` workflow run.
4. Check the job named `admin-auth-tests`.

Workflow file:
- `.github/workflows/ci.yml`

## Google OAuth Notes

In Supabase:
- Enable Google provider under Authentication -> Providers.

In Google Cloud OAuth client:
- Add the Supabase callback URL shown in your project settings.

## Additional Documentation

Full project notes:
- https://www.notion.so/Learnership-and-skills-development-portal-3343fd7b5182800e9940f1bbc3d68105?source=copy_link
