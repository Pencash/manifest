import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Note: This is an admin function. In production, you should add authentication checks here.
    // For now, we'll allow it to run for testing purposes.
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Create admin user
    const { data: adminUser, error: adminError } = await supabaseAdmin.auth.admin.createUser({
      email: 'admin@test.com',
      password: 'Admin123!',
      email_confirm: true,
      user_metadata: {
        full_name: 'Admin User',
        phone: '+1234567890'
      }
    })

    if (adminError) throw adminError

    // Create finance user
    const { data: financeUser, error: financeError } = await supabaseAdmin.auth.admin.createUser({
      email: 'finance@test.com',
      password: 'Finance123!',
      email_confirm: true,
      user_metadata: {
        full_name: 'Finance User',
        phone: '+1234567891'
      }
    })

    if (financeError) throw financeError

    // Assign admin role
    const { error: adminRoleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: adminUser.user.id,
        role: 'admin'
      })

    if (adminRoleError) throw adminRoleError

    // Assign finance role
    const { error: financeRoleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: financeUser.user.id,
        role: 'finance'
      })

    if (financeRoleError) throw financeRoleError

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Test users created successfully',
        users: {
          admin: {
            email: 'admin@test.com',
            password: 'Admin123!'
          },
          finance: {
            email: 'finance@test.com',
            password: 'Finance123!'
          }
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
