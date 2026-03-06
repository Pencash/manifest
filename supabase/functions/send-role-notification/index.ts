import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";
import { assertRequiredFields, getCorsHeaders, getRequestUser } from "../_shared/security.ts";

interface RoleNotificationRequest {
  email: string;
  name: string;
  newRole: string;
  userId: string;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user, userClient } = await getRequestUser(req);

    const { data: rolesData, error: rolesError } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (rolesError) {
      return new Response(JSON.stringify({ error: "Role check failed" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const isAllowed = (rolesData || []).some((entry) =>
      ["admin", "pastor", "finance"].includes(entry.role),
    );

    if (!isAllowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const payload: RoleNotificationRequest = await req.json();
    assertRequiredFields(payload, ["email", "name", "newRole", "userId"]);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    console.log(`Role changed for ${payload.name} (${payload.email}) to ${payload.newRole}`);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { error: auditError } = await adminClient.from("audit_logs").insert({
      user_id: user.id,
      action: "role_notification_sent",
      table_name: "user_roles",
      record_id: payload.userId,
      new_values: {
        email: payload.email,
        name: payload.name,
        newRole: payload.newRole,
        notifiedAt: new Date().toISOString(),
      },
    });

    if (auditError) {
      console.error("Failed to insert audit log:", auditError);
      return new Response(JSON.stringify({ error: "Failed to write audit log" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Notification logged successfully",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      },
    );
  } catch (error: any) {
    const message = error?.message ?? "Internal server error";
    const status = message === "Unauthorized" || message === "Missing authorization header" ? 401 : 500;

    console.error("Error in send-role-notification function:", error);
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
