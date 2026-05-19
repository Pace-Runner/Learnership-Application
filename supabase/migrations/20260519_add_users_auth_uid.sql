-- Store the Supabase auth user id alongside the public users table id.
-- This keeps public foreign keys stable while letting storage lookups use the auth folder.

alter table if exists users
  add column if not exists auth_uid uuid;

create unique index if not exists users_auth_uid_key on users (auth_uid);

update users u
set auth_uid = a.id
from auth.users a
where lower(a.email) = lower(u.email)
  and u.auth_uid is null;