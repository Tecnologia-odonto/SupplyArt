import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

Deno.serve(async (req) => {
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

    console.log('Creating user with data:', { email, name, role, unit_id })

    // Validate required fields
    if (!email || !password || !name || !role) {
      throw new Error('Missing required fields: email, password, name, and role are required')
    }

    // Validate role
    const validRoles = ['admin', 'gestor', 'operador-financeiro', 'operador-administrativo', 'operador-almoxarife']
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`)
    }

    // Check if user already exists by email
    const { data: existingUsers, error: listError } = await supabaseClient.auth.admin.listUsers()
    
    if (listError) {
      console.error('Error listing users:', listError)
    } else {
      const userExists = existingUsers.users.some(user => user.email === email)
      if (userExists) {
        throw new Error('User already registered')
      }
    }

    // Create user in auth.users
    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { 
        name, 
        role, 
        unit_id: unit_id || null 
      }
    })

    if (authError) {
      console.error('Auth creation error:', authError)
      throw new Error(`User creation failed: ${authError.message}`)
    }

    if (!authData.user) {
      throw new Error('User creation failed: No user returned')
    }

    console.log('User created in auth:', authData.user.id)

    // Wait a bit for auth user to be fully created
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Create profile manually with proper error handling
    const profileData = {
      id: authData.user.id,
      name: name,
      email: email,
      role: role,
      unit_id: unit_id || null
    }

    console.log('Creating profile with data:', profileData)

    // First, check if profile already exists (in case trigger created it)
    const { data: existingProfile, error: checkProfileError } = await supabaseClient
      .from('profiles')
      .select('id')
      .eq('id', authData.user.id)
      .maybeSingle()

    if (checkProfileError && checkProfileError.code !== 'PGRST116') {
      console.error('Error checking existing profile:', checkProfileError)
    }

    let profileResult
    if (existingProfile) {
      // Profile exists, update it
      console.log('Profile exists, updating...')
      const { data: updatedProfile, error: updateError } = await supabaseClient
        .from('profiles')
        .update({
          name: name,
          email: email,
          role: role,
          unit_id: unit_id || null
        })
        .eq('id', authData.user.id)
        .select()
        .single()

      if (updateError) {
        console.error('Profile update error:', updateError)
        throw new Error(`Profile update failed: ${updateError.message}`)
      }
      profileResult = { data: updatedProfile }
    } else {
      // Profile doesn't exist, create it
      console.log('Profile does not exist, creating...')
      const { data: newProfile, error: insertError } = await supabaseClient
        .from('profiles')
        .insert(profileData)
        .select()
        .single()

      if (insertError) {
        console.error('Profile creation error:', insertError)
        
        // If profile creation fails, try to delete the auth user to maintain consistency
        try {
          await supabaseClient.auth.admin.deleteUser(authData.user.id)
          console.log('Cleaned up auth user due to profile creation failure')
        } catch (cleanupError) {
          console.error('Failed to cleanup auth user:', cleanupError)
        }
        
        throw new Error(`Profile creation failed: ${insertError.message}`)
      }
      profileResult = { data: newProfile }
    }

    console.log('Profile operation successful:', profileResult.data)

    // Create audit log with system user ID for system operation
    try {
      const { error: auditError } = await supabaseClient
        .from('audit_logs')
        .insert({
          user_id: null,
          action: 'USER_CREATED_BY_ADMIN',
          table_name: 'profiles',
          record_id: authData.user.id,
          new_values: {
            email,
            name,
            role,
            unit_id: unit_id || null,
            created_by_system: true,
            timestamp: new Date().toISOString()
          }
        })

      if (auditError) {
        console.error('Audit log creation failed:', auditError)
        // Don't fail the entire operation for audit log issues
      }
    } catch (auditLogError) {
      console.error('Audit log creation failed:', auditLogError)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: authData.user,
        profile: profileResult.data,
        message: 'User and profile created successfully'
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