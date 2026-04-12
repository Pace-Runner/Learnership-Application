# Learnership Application Portal

<img src="https://img.shields.io/badge/Type-University Project-1f6feb" alt="University Project">
<img src="https://img.shields.io/badge/Frontend-React-61DAFB?logo=react&amp;logoColor=black" alt="React">
<img src="https://img.shields.io/badge/Build-Vite-646CFF?logo=vite&amp;logoColor=white" alt="Vite">
<img src="https://img.shields.io/badge/Backend-Supabase-3ECF8E?logo=supabase&amp;logoColor=white" alt="Supabase">
<img src="https://img.shields.io/badge/Language-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
<img src="https://img.shields.io/badge/Language-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">

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


## Run Locally

```bash
cd frontend
npm install
npm run dev
```

## Test Coverage and CI

Current test files:
- `frontend/src/pages/UserPages.test.jsx`
- `frontend/src/App.test.jsx`

### Applicant tests

- [x] Applicant workspace renders correctly
- [x] Quick stats display all required metrics
- [x] Listings section and search controls visible
- [x] Example listings and profile navigation present
- [x] Logout button functional
- [x] Profile page renders with document actions

### Provider tests

- [ ] Provider model includes organisation name field
- [x] Google OAuth entry is available for provider registration
- [ ] Provider role assignment is wired in OAuth callback flow
- [ ] Provider selection leads to provider route
- [ ] Provider route is protected and mounted correctly

### Admin tests

- [ ] Unauthenticated users can't access /admin
- [ ] Wrong role gets redirected away from /admin
- [ ] Admin email gets the Admin role assigned
- [ ] Non-admin email never gets the Admin role
- [ ] Admin lands on /admin after login
- [ ] Admin can see the dashboard
- [ ] Admin session survives a page refresh
- [ ] Logout from admin clears the session
- [ ] Admin moderation UI has the right controls
- [ ] Example admin emails are in the database

### Role based tests

#### Role-based redirect logic on OAuth completion

- [ ] Applicant role redirects to /dashboard
- [ ] Provider role redirects to /provider
- [ ] Admin role redirects to /admin
- [x] Unauthenticated users blocked from protected routes
- [ ] Role isolation enforced

#### Route guard and access control implementation

- [ ] ProtectedRoute component guards all authenticated routes
- [ ] Redirect logic implemented for unauthorized access
- [ ] Auth loading state displays during verification
- [ ] getLandingRoute function routes each role correctly
- [ ] Protected route middleware prevents cross-role navigation

#### Route architecture and mounting

- [ ] All role routes mounted in App.jsx
- [ ] Provider route mounts Provider component
- [ ] Admin route mounts Admin dashboard
- [ ] Dashboard route mounts Applicant dashboard
- [ ] Each route requires correct role in ProtectedRoute

#### Code coverage and CI infrastructure

- [ ] Vitest + v8 coverage configured
- [ ] Coverage reports generated and integrated
- [ ] Role-sensitive components have high coverage
- [ ] GitHub Actions CI runs test pipeline
- [ ] Tests pass in CI environment

### Run tests locally

```bash
cd frontend
npm test
```

### See tests in GitHub Actions

1. Push your branch to GitHub.
2. Open the Actions tab in your repository.
3. Open the latest `CI` workflow run.

## Google OAuth Notes

In Supabase:
- Enable Google provider under Authentication -> Providers.


## Additional Documentation

Full project notes:
- https://www.notion.so/Learnership-and-skills-development-portal-3343fd7b5182800e9940f1bbc3d68105?source=copy_link
