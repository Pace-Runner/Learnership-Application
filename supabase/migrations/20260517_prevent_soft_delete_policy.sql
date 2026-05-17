-- Migration: Prevent soft-delete by disallowing updates that set status = 'Deleted'
-- This policy ensures clients cannot mark an opportunity as 'Deleted'.
-- Deleting rows (hard delete) remains allowed where existing policies permit it.

BEGIN;

-- Remove existing policy if present (idempotent)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policy p JOIN pg_class c ON p.polrelid = c.oid
    WHERE c.relname = 'opportunities' AND p.polname = 'no_soft_delete'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS no_soft_delete ON public.opportunities';
  END IF;
END$$;

-- Create policy to prevent setting status = 'Deleted' via UPDATE
CREATE POLICY no_soft_delete
  ON public.opportunities
  FOR UPDATE
  USING (true)
  WITH CHECK (status IS DISTINCT FROM 'Deleted');

COMMIT;

-- NOTE: Run this migration in Supabase SQL editor. This prevents client updates that set status to 'Deleted'.
