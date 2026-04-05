import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";
import { getCorsHeaders, getRequestUser, assertRequiredFields } from "../_shared/security.ts";

type CreateRequest = {
  email?: string;
  password?: string;
  fullName?: string;
  phone?: string;
  role?: string;
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
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );

    // Verify caller is admin
    const { data: isAdmin, error: roleError } = await supabaseClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (roleError) throw roleError;

    if (!isAdmin) {
      return new Response(JSON.stringify({ message: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: CreateRequest = await req.json();
    assertRequiredFields(payload, ["email", "password", "fullName"]);

    const email = payload.email!.trim().toLowerCase();
    const password = payload.password!;
    const fullName = payload.fullName!.trim();
    const phone = payload.phone?.trim() || "";
    const role = payload.role || "member";

    if (password.length < 6) {
      return new Response(JSON.stringify({ message: "Password must be at least 6 characters" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create the auth user with email pre-confirmed
    const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone },
    });

    if (createError) throw createError;

    const newUserId = newUser.user.id;

    // If role is not "member", update the auto-assigned role
    if (role !== "member") {
      // Delete the default "member" role assigned by the trigger
      await supabaseClient
        .from("user_roles")
        .delete()
        .eq("user_id", newUserId);

      // Insert the specified role
      const { error: roleInsertError } = await supabaseClient
        .from("user_roles")
        .insert({
          user_id: newUserId,
          role,
          assigned_by: user.id,
        });

      if (roleInsertError) {
        console.error("Error assigning role:", roleInsertError);
        // User was created but role assignment failed - not fatal
      }
    }

    return new Response(JSON.stringify({ success: true, userId: newUserId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    const message = error?.message ?? "Internal server error";
    const status = message === "Unauthorized" || message === "Missing authorization header" ? 401 : 500;

    console.error("Error creating user:", error);
    return new Response(JSON.stringify({ message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
