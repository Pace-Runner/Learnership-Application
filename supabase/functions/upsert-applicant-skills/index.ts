// SUPABASE EDGE FUNCTION: Atomically replaces an applicant's skills.
// REQUIRED SECRETS:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { applicantId, skillTagIds } = await request.json()

    if (!applicantId || !Array.isArray(skillTagIds)) {
      return new Response(
        JSON.stringify({ error: 'Missing applicantId or skillTagIds.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secret.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const uniqueSkillTagIds = [...new Set(skillTagIds.filter(Boolean))]

    const { error: deleteError } = await adminClient
      .from('applicant_skills')
      .delete()
      .eq('applicant_id', applicantId)

    if (deleteError) {
      return new Response(
        JSON.stringify({ error: 'Could not clear existing applicant skills.', details: deleteError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (uniqueSkillTagIds.length > 0) {
      const { error: insertError } = await adminClient.from('applicant_skills').insert(
        uniqueSkillTagIds.map((skillTagId) => ({
          applicant_id: applicantId,
          skill_tag_id: skillTagId,
        })),
      )

      if (insertError) {
        return new Response(
          JSON.stringify({ error: 'Could not save applicant skills.', details: insertError.message }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        )
      }
    }

    return new Response(
      JSON.stringify({ success: true, savedCount: uniqueSkillTagIds.length }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected skills error.' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
