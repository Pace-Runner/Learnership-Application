-- Migration: Remove leftover opportunities with status = 'Deleted'
-- Run this in Supabase SQL editor or via psql. It will delete opportunities
-- marked as 'Deleted' and rely on ON DELETE CASCADE to remove related rows.

BEGIN;

-- Safety check: list affected opportunities (run first if you want to review)
-- SELECT id, title, provider_id, status, created_at FROM public.opportunities WHERE status = 'Deleted';

-- Delete the opportunities and cascade to dependent tables (requirements, skills, applications, favourites)
DELETE FROM public.opportunities WHERE status = 'Deleted';

COMMIT;

-- Note: This is irreversible. Back up your data before running.
