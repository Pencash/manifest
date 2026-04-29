import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";
import { getCorsHeaders, getRequestUser, assertRequiredFields } from "../_shared/security.ts";

type UpdatePasswordRequest = {
  userId?: string;
  newPassword?: string;
};

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user } = await getRequestUser(req);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: roles, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .limit(1);

    if (roleError) throw roleError;
    const isAdmin = (roles || []).length > 0;

    if (!isAdmin) {
      return new Response(JSON.stringify({ message: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: UpdatePasswordRequest = await req.json();
    assertRequiredFields(payload, ["userId", "newPassword"]);

    if ((payload.newPassword ?? "").length < 6) {
      return new Response(JSON.stringify({ message: "Password must be at least 6 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payload.userId === user.id) {
      return new Response(JSON.stringify({ message: "Use account settings to update your own password" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await supabaseClient.auth.admin.updateUserById(payload.userId!, {
      password: payload.newPassword,
    });

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    const message = error?.message ?? "Internal server error";
    const status = message === "Unauthorized" || message === "Missing authorization header" ? 401 : 500;

    console.error("Error updating user password:", error);
    return new Response(JSON.stringify({ message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
