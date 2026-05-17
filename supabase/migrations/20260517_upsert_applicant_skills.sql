-- Migration: add RPC to atomically upsert applicant skills

-- SECURITY DEFINER function that updates applicant_skills atomically.
-- Run this in Supabase SQL editor as an admin.

CREATE OR REPLACE FUNCTION public.upsert_applicant_skills(
  p_applicant_id uuid,
  p_skill_tag_ids uuid[]
)
RETURNS TABLE(inserted_count integer, deleted_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  del_count int := 0;
  ins_count int := 0;
BEGIN
  -- Delete any links that are NOT in the desired list
  IF p_skill_tag_ids IS NULL OR array_length(p_skill_tag_ids,1) = 0 THEN
    DELETE FROM applicant_skills
    WHERE applicant_id = p_applicant_id;
    GET DIAGNOSTICS del_count = ROW_COUNT;
  ELSE
    DELETE FROM applicant_skills
    WHERE applicant_id = p_applicant_id
      AND skill_tag_id NOT IN (SELECT unnest(p_skill_tag_ids));
    GET DIAGNOSTICS del_count = ROW_COUNT;
  END IF;

  -- Insert missing links for the requested tags (only if the tag exists)
  INSERT INTO applicant_skills (applicant_id, skill_tag_id)
  SELECT p_applicant_id, st.id
  FROM skill_tags st
  WHERE st.id = ANY(p_skill_tag_ids)
    AND NOT EXISTS (
      SELECT 1 FROM applicant_skills a
      WHERE a.applicant_id = p_applicant_id AND a.skill_tag_id = st.id
    );

  GET DIAGNOSTICS ins_count = ROW_COUNT;

  RETURN QUERY SELECT ins_count, del_count;
END;
$$;

-- Allow authenticated users to execute the RPC (function runs as definer so it's safe)
GRANT EXECUTE ON FUNCTION public.upsert_applicant_skills(uuid, uuid[]) TO authenticated;
