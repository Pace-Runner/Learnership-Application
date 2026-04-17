# Learnership Frontend (Vite + Supabase)

## 1. Environment variables

Create `frontend/.env` from `frontend/.env.example`.

```env
VITE_SUPABASE_URL=https://rgkvcwvubnhffuwnxxas.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_AUTH_REDIRECT_URL=http://localhost:5173/
```

You can copy the anon key from Supabase: Project Settings -> API -> Project API keys.

## 2. Database schema

Run the SQL in `supabase/schema.sql` in Supabase SQL Editor.

If you enable RLS on `users`, also run `supabase/rls.sql`.

Important: replace seeded admin emails in the insert block with your real Google account emails.

## 3. Google OAuth provider setup

In Supabase:
1. Authentication -> Providers -> Google -> Enable.
2. Paste Google Client ID and Client Secret.
3. Authentication -> URL Configuration -> add all local dev URLs to Redirect URLs:

```text
http://localhost:5173/
http://127.0.0.1:5173/
```

If you open Vite using a LAN IP (for example `http://192.168.x.x:5173`), add that exact URL as well.

In Google Cloud Console OAuth Client (Web application):
1. Add this exact redirect URI:

```text
https://rgkvcwvubnhffuwnxxas.supabase.co/auth/v1/callback
```

## 4. How role mapping works

After Google login:
1. Supabase creates/restores the authenticated session.
2. The app checks `users` table by email.
3. If email exists, it uses that role (Applicant, Provider, Admin).
4. If email does not exist, user picks `Applicant` or `Provider` in the UI.
5. The app inserts that selected role into `users`.
6. User is redirected to role page:
	- Applicant -> `/dashboard`
	- Provider -> `/provider`
	- Admin -> `/admin`

## 5. Run locally

```bash
npm install
npm run dev
```
