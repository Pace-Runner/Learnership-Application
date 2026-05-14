// SUPABASE EDGE FUNCTION: Deletes a user account, related profile records, logs the action, and sends a deletion email.
// REQUIRED SECRETS:
// - BREVO_API_KEY
// - BREVO_FROM_EMAIL
// - BREVO_FROM_NAME

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
        JSON.stringify({ error: 'Missing required userId field.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const brevoApiKey = Deno.env.get('BREVO_API_KEY')
    const brevoFromEmail = Deno.env.get('BREVO_FROM_EMAIL')
    const brevoFromName = Deno.env.get('BREVO_FROM_NAME') || 'Learnership Portal'

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

    const { data: userRow, error: userLookupError } = await adminClient
      .from('users')
      .select('id,email,role')
      .eq('id', userId)
      .maybeSingle()

    if (userLookupError || !userRow) {
      return new Response(
        JSON.stringify({ error: 'Could not resolve user account.' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const accountRole = role || userRow.role || 'Applicant'
    const recipientEmail = userRow.email

    if (accountRole === 'Applicant') {
      const { data: applicantProfile } = await adminClient
        .from('applicant_profiles')
        .select('id')
        .eq('user_id', userRow.id)
        .maybeSingle()

      if (applicantProfile?.id) {
        await adminClient.from('applicant_education').delete().eq('applicant_id', applicantProfile.id)
        await adminClient.from('applicant_skills').delete().eq('applicant_id', applicantProfile.id)
        await adminClient.from('applications').delete().eq('applicant_id', applicantProfile.id)
        await adminClient.from('favourites').delete().eq('applicant_id', applicantProfile.id)
        await adminClient.from('applicant_profiles').delete().eq('id', applicantProfile.id)
      }
    }

    if (accountRole === 'Provider') {
      const { data: providerProfiles } = await adminClient
        .from('provider_profiles')
        .select('id')
        .eq('user_id', userRow.id)

      const providerProfileIds = (providerProfiles || []).map((profile) => profile.id).filter(Boolean)

      if (providerProfileIds.length) {
        const { data: opportunities } = await adminClient
          .from('opportunities')
          .select('id')
          .in('provider_id', providerProfileIds)

        const opportunityIds = (opportunities || []).map((opportunity) => opportunity.id).filter(Boolean)

        if (opportunityIds.length) {
          await adminClient.from('opportunity_requirements').delete().in('opportunity_id', opportunityIds)
          await adminClient.from('opportunity_skills').delete().in('opportunity_id', opportunityIds)
          await adminClient.from('applications').delete().in('opportunity_id', opportunityIds)
          await adminClient.from('favourites').delete().in('opportunity_id', opportunityIds)
          await adminClient.from('opportunities').delete().in('id', opportunityIds)
        }

        await adminClient.from('provider_profiles').delete().in('id', providerProfileIds)
      }
    }

    await adminClient.from('notifications').delete().eq('user_id', userRow.id)
    await adminClient.from('email_logs').delete().eq('user_id', userRow.id)
    await adminClient.from('users').delete().eq('id', userRow.id)

    const { data: authUsers } = await adminClient.auth.admin.listUsers()
    const authUser = authUsers?.users?.find((candidate) => candidate.email?.toLowerCase() === userRow.email?.toLowerCase())

    if (authUser?.id) {
      await adminClient.auth.admin.deleteUser(authUser.id)
    }

    await adminClient.from('admin_actions').insert({
      admin_id: adminId || null,
      action_type: 'account_deleted',
      target_type: 'user',
      target_id: userRow.id,
      reason: reason || null,
    })

    if (!recipientEmail || !brevoApiKey || !brevoFromEmail) {
      await adminClient.from('email_logs').insert({
        user_id: userRow.id,
        subject: 'Your account has been deleted',
        status: 'failed',
      })

      return new Response(
        JSON.stringify({ success: true, emailSent: false }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const subject = 'Your account has been deleted'
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #10223d;">
        <h2 style="margin-bottom: 12px;">Account deleted</h2>
        <p>Hi,</p>
        <p>Your Learnership Portal account has been deleted by an administrator.</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        <p>If you believe this was a mistake, please contact support.</p>
      </div>
    `

    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: brevoFromName,
          email: brevoFromEmail,
        },
        to: [
          {
            email: recipientEmail,
          },
        ],
        subject,
        htmlContent: html,
      }),
    })

    if (!brevoResponse.ok) {
      await adminClient.from('email_logs').insert({
        user_id: userRow.id,
        subject,
        status: 'failed',
      })

      return new Response(
        JSON.stringify({ success: true, emailSent: false }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    await adminClient.from('email_logs').insert({
      user_id: userRow.id,
      subject,
      status: 'sent',
    })

    return new Response(
      JSON.stringify({ success: true, emailSent: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected account deletion error.' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
