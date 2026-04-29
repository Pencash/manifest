import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";
import { getCorsHeaders, getRequestUser, assertRequiredFields } from "../_shared/security.ts";

type DeleteRequest = {
  userId?: string;
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

    const payload: DeleteRequest = await req.json();
    assertRequiredFields(payload, ["userId"]);

    if (payload.userId === user.id) {
      return new Response(JSON.stringify({ message: "You cannot delete your own account" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(payload.userId!);

    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    const message = error?.message ?? "Internal server error";
    const status = message === "Unauthorized" || message === "Missing authorization header" ? 401 : 500;

    console.error("Error deleting user:", error);
    return new Response(JSON.stringify({ message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
