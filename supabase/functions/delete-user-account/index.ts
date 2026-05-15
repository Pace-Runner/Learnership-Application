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
    const { userId, role, reason, adminId } = await request.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing userId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Missing environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Get applicant profile IDs
    const { data: applicantProfiles } = await adminClient
      .from('applicant_profiles')
      .select('id')
      .eq('user_id', userId)

    if (applicantProfiles && applicantProfiles.length > 0) {
      const applicantIds = applicantProfiles.map(p => p.id)
      
      await adminClient.from('applicant_education').delete().in('applicant_id', applicantIds)
      await adminClient.from('applicant_skills').delete().in('applicant_id', applicantIds)
      await adminClient.from('applications').delete().in('applicant_id', applicantIds)
      await adminClient.from('favourites').delete().in('applicant_id', applicantIds)
      await adminClient.from('applicant_profiles').delete().in('id', applicantIds)
    }

    // Get provider profile IDs
    const { data: providerProfiles } = await adminClient
      .from('provider_profiles')
      .select('id')
      .eq('user_id', userId)

    if (providerProfiles && providerProfiles.length > 0) {
      const providerIds = providerProfiles.map(p => p.id)

      // Get opportunity IDs
      const { data: opportunities } = await adminClient
        .from('opportunities')
        .select('id')
        .in('provider_id', providerIds)

      if (opportunities && opportunities.length > 0) {
        const opportunityIds = opportunities.map(o => o.id)
        
        await adminClient.from('opportunity_requirements').delete().in('opportunity_id', opportunityIds)
        await adminClient.from('opportunity_skills').delete().in('opportunity_id', opportunityIds)
        await adminClient.from('applications').delete().in('opportunity_id', opportunityIds)
        await adminClient.from('favourites').delete().in('opportunity_id', opportunityIds)
        await adminClient.from('opportunities').delete().in('id', opportunityIds)
      }

      await adminClient.from('provider_profiles').delete().in('id', providerIds)
    }

    // Delete user records
    await adminClient.from('notifications').delete().eq('user_id', userId)
    await adminClient.from('email_logs').delete().eq('user_id', userId)
    await adminClient.from('users').delete().eq('id', userId)

    // Log the action
    await adminClient.from('admin_actions').insert({
      admin_id: adminId || null,
      action_type: 'account_deleted',
      target_type: role?.toLowerCase() || 'user',
      target_id: userId,
      reason: reason || null,
    })

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to delete user' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
