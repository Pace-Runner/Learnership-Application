-- Run this only if you plan to enable RLS on users table.

alter table users enable row level security;

-- Authenticated users can read only their own row.
create policy if not exists "users_select_own"
  on users
  for select
  to authenticated
  using (email = auth.jwt() ->> 'email');

-- Authenticated users can insert only their own row.
create policy if not exists "users_insert_own"
  on users
  for insert
  to authenticated
  with check (email = auth.jwt() ->> 'email');
