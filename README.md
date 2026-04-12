# Learnership Application Portal

<img src="https://img.shields.io/badge/Type-University Project-1f6feb" alt="University Project">
<img src="https://img.shields.io/badge/Frontend-React-61DAFB?logo=react&amp;logoColor=black" alt="React">
<img src="https://img.shields.io/badge/Build-Vite-646CFF?logo=vite&amp;logoColor=white" alt="Vite">
<img src="https://img.shields.io/badge/Backend-Supabase-3ECF8E?logo=supabase&amp;logoColor=white" alt="Supabase">
<img src="https://img.shields.io/badge/Language-JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript"> , <img src="https://img.shields.io/badge/Language-HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">

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

## Google OAuth Notes

In Supabase:
- Enable Google provider under Authentication -> Providers.


## Additional Documentation

Full project notes:
- https://www.notion.so/Learnership-and-skills-development-portal-3343fd7b5182800e9940f1bbc3d68105?source=copy_link
