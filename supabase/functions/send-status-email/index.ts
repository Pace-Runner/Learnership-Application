// SUPABASE EDGE FUNCTION: Sends applicant status update emails through Brevo.
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
    const { applicationId, applicantName, listingTitle, statusLabel } = await request.json()

    if (!applicationId || !listingTitle || !statusLabel) {
      return new Response(
        JSON.stringify({ error: 'Missing required email payload fields.' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const brevoApiKey = Deno.env.get('BREVO_API_KEY')
    const brevoFromEmail = Deno.env.get('BREVO_FROM_EMAIL')
    const brevoFromName = Deno.env.get('BREVO_FROM_NAME') || 'Learnership Portal'
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

    const { data: applicationRow, error: applicationLookupError } = await adminClient
      .from('applications')
      .select('id,applicant_id')
      .eq('id', applicationId)
      .maybeSingle()

    if (applicationLookupError || !applicationRow?.applicant_id) {
      return new Response(
        JSON.stringify({ error: 'Could not resolve application applicant.' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const { data: applicantProfile, error: applicantLookupError } = await adminClient
      .from('applicant_profiles')
      .select('user_id,first_name,last_name')
      .eq('id', applicationRow.applicant_id)
      .maybeSingle()

    if (applicantLookupError || !applicantProfile?.user_id) {
      return new Response(
        JSON.stringify({ error: 'Could not resolve applicant profile user.' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const notificationMessage = `Your application for ${listingTitle} is now ${statusLabel}.`
    const { error: notificationError } = await adminClient
      .from('notifications')
      .insert({
        user_id: applicantProfile.user_id,
        type: 'status_update',
        message: notificationMessage,
      })

    if (notificationError) {
      return new Response(
        JSON.stringify({ error: 'Could not create in-app notification.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const { data: recipientUser } = await adminClient
      .from('users')
      .select('email')
      .eq('id', applicantProfile.user_id)
      .maybeSingle()

    if (!brevoApiKey || !brevoFromEmail || !recipientUser?.email) {
      await adminClient
        .from('email_logs')
        .insert({
          user_id: applicantProfile.user_id,
          subject: `Application update: ${listingTitle}`,
          status: 'failed',
        })

      return new Response(
        JSON.stringify({
          success: true,
          notificationSent: true,
          emailSent: false,
          error: !brevoApiKey
            ? 'Missing BREVO_API_KEY secret.'
            : !brevoFromEmail
              ? 'Missing BREVO_FROM_EMAIL secret.'
              : 'Could not resolve applicant email address.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const fallbackApplicantName = `${applicantProfile.first_name || 'Applicant'} ${applicantProfile.last_name || ''}`.trim()
    const safeApplicantName = applicantName || fallbackApplicantName
    const subject = `Application update: ${listingTitle}`
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #10223d;">
        <h2 style="margin-bottom: 12px;">Application status update</h2>
        <p>Hi ${safeApplicantName},</p>
        <p>Your application for <strong>${listingTitle}</strong> is now <strong>${statusLabel}</strong>.</p>
        <p>Please sign in to the Learnership Portal to review the latest details.</p>
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
            email: recipientUser.email,
            name: safeApplicantName,
          },
        ],
        subject,
        htmlContent: html,
      }),
    })

    if (!brevoResponse.ok) {
      await adminClient
        .from('email_logs')
        .insert({
          user_id: applicantProfile.user_id,
          subject,
          status: 'failed',
        })

      return new Response(
        JSON.stringify({
          success: true,
          notificationSent: true,
          emailSent: false,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const brevoPayload = await brevoResponse.json()

    await adminClient
      .from('email_logs')
      .insert({
        user_id: applicantProfile.user_id,
        subject,
        status: 'sent',
      })

    return new Response(
      JSON.stringify({
        success: true,
        notificationSent: true,
        emailSent: true,
        id: brevoPayload.messageId,
        subject,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected email error.' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
