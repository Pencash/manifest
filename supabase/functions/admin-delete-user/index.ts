import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getSupabaseClient = (req: Request) =>
  createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    {
      global: {
        headers: { Authorization: req.headers.get("Authorization")! },
      },
    }
  );

type DeleteRequest = {
  userId?: string;
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseClient = getSupabaseClient(req);

  try {
    const { data: authData, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !authData?.user) {
      return new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin, error: roleError } = await supabaseClient.rpc("has_role", {
      _user_id: authData.user.id,
      _role: "admin",
    });

    if (roleError) throw roleError;

    if (!isAdmin) {
      return new Response(JSON.stringify({ message: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId }: DeleteRequest = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ message: "User ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (userId === authData.user.id) {
      return new Response(JSON.stringify({ message: "You cannot delete your own account" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(userId);

    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    return new Response(JSON.stringify({ message: error?.message ?? "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
