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
    const brevoApiKey = Deno.env.get('BREVO_API_KEY')
    const brevoFromEmail = Deno.env.get('BREVO_FROM_EMAIL')
    const brevoFromName = Deno.env.get('BREVO_FROM_NAME') || 'Learnership Application'

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Missing environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Fetch user email before deletion (needed for deletion email)
    const { data: userRow } = await adminClient
      .from('users')
      .select('email')
      .eq('id', userId)
      .maybeSingle()

    // Handle applicant deletion
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

    // Handle provider deletion
    const { data: providerProfiles } = await adminClient
      .from('provider_profiles')
      .select('id')
      .eq('user_id', userId)

    if (providerProfiles && providerProfiles.length > 0) {
      const providerIds = providerProfiles.map(p => p.id)

      const { data: opportunities } = await adminClient
        .from('opportunities')
        .select('id')
        .in('provider_id', providerIds)

      if (opportunities && opportunities.length > 0) {
        const opportunityIds = opportunities.map(o => o.id)
        
        // Delete opportunity-related records first
        await adminClient.from('opportunity_requirements').delete().in('opportunity_id', opportunityIds)
        await adminClient.from('opportunity_skills').delete().in('opportunity_id', opportunityIds)
        await adminClient.from('applications').delete().in('opportunity_id', opportunityIds)
        await adminClient.from('favourites').delete().in('opportunity_id', opportunityIds)
        
        // Then delete opportunities
        await adminClient.from('opportunities').delete().in('id', opportunityIds)
      }

      // Delete provider profiles
      await adminClient.from('provider_profiles').delete().in('id', providerIds)
    }

    // Send deletion email BEFORE deleting user (need user_id for email_logs FK)
    let emailSent = false
    if (userRow?.email && brevoApiKey && brevoFromEmail) {
      const subject = 'Your Account Has Been Deleted - Learnership Application'
      const roleLabel = role === 'Applicant' ? 'applicant' : role === 'Provider' ? 'provider' : 'user'
      const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #10223d;">
          <h2 style="margin-bottom: 12px;">Your account has been deleted</h2>
          <p>Your ${roleLabel} account on Learnership Application has been deleted.</p>
          ${reason ? `<p><strong>Reason provided:</strong></p><p style="background-color: #f5f5f5; padding: 12px; border-left: 4px solid #dc3545;">${reason}</p>` : ''}
          <p>If you believe this was done in error or have questions, please contact our support team.</p>
        </div>
      `

      try {
        const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'api-key': brevoApiKey,
          },
          body: JSON.stringify({
            sender: { email: brevoFromEmail, name: brevoFromName },
            to: [{ email: userRow.email }],
            subject: subject,
            htmlContent: html,
          }),
        })

        emailSent = brevoResponse.ok

        const emailLogged = await adminClient
          .from('email_logs')
          .insert({
            user_id: userId,
            subject: subject,
            status: brevoResponse.ok ? 'sent' : 'failed',
          })

        if (emailLogged.error) {
          console.error('Failed to log email:', emailLogged.error)
        }
      } catch (emailError) {
        console.error('Failed to send deletion email:', emailError)
        // Log the failure but continue with user deletion
        await adminClient
          .from('email_logs')
          .insert({
            user_id: userId,
            subject: 'Your Account Has Been Deleted - Learnership Application',
            status: 'failed',
          })
          .catch(() => {
            // Ignore error if email_logs insert fails
          })
      }
    } else if (userRow?.email && (!brevoApiKey || !brevoFromEmail)) {
      // Log attempt to send email even if Brevo not configured
      await adminClient
        .from('email_logs')
        .insert({
          user_id: userId,
          subject: 'Your Account Has Been Deleted - Learnership Application',
          status: 'failed',
        })
        .catch(() => {
          // Ignore error if email_logs insert fails
        })
    }

    // Log the action BEFORE deleting user (in case of FK constraint on admin_actions.target_id)
    await adminClient.from('admin_actions').insert({
      admin_id: adminId || null,
      action_type: 'account_deleted',
      target_type: role?.toLowerCase() || 'user',
      target_id: userId,
      reason: reason || null,
    })

    // Delete user records (notifications will cascade, but keep email logs for audit trail)
    await adminClient.from('notifications').delete().eq('user_id', userId)
    await adminClient.from('users').delete().eq('id', userId)

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
