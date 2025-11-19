import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RoleNotificationRequest {
  email: string;
  name: string;
  newRole: string;
  userId: string;
  assignedBy: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, name, newRole, userId, assignedBy }: RoleNotificationRequest = await req.json();

    console.log(`Role changed for ${name} (${email}) to ${newRole}`);

    // Log to audit_logs table for security tracking
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabaseClient.from('audit_logs').insert({
      user_id: assignedBy,
      action: 'role_notification_sent',
      table_name: 'user_roles',
      record_id: userId,
      new_values: {
        email,
        name,
        newRole,
        notifiedAt: new Date().toISOString()
      }
    });

    // Note: To actually send emails, you would need to integrate with a service like Resend
    // For now, this logs the notification
    // If you want email notifications, you'll need to add the RESEND_API_KEY secret
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Notification logged successfully"
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-role-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
