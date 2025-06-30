import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// System UUID for operations performed by the system
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { email, password, name, role, unit_id } = await req.json()

    // Create user in auth.users
    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role, unit_id }
    })

    if (authError) {
      throw new Error(`User creation failed: ${authError.message}`)
    }

    if (!authData.user) {
      throw new Error('User creation failed: No user returned')
    }

    // Wait a moment for the trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Create audit log with system user ID for system operation
    const { error: auditError } = await supabaseClient
      .from('audit_logs')
      .insert({
        user_id: SYSTEM_USER_ID, // Use system UUID instead of null
        action: 'USER_CREATED_BY_ADMIN',
        table_name: 'profiles',
        record_id: authData.user.id,
        new_values: {
          email,
          name,
          role,
          unit_id,
          created_by_system: true,
          timestamp: new Date().toISOString()
        }
      })

    if (auditError) {
      console.error('Audit log creation failed:', auditError)
      // Don't fail the entire operation for audit log issues
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: authData.user,
        message: 'User created successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in create-user function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unexpected error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})