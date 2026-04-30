import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";
import { getCorsHeaders, getRequestUser } from "../_shared/security.ts";

const rolePriority: Record<string, number> = {
  admin: 4,
  pastor: 3,
  finance: 2,
  member: 1,
};

const getHighestRole = (roles: string[]) =>
  roles.reduce<string | null>((highest, role) => {
    if (!rolePriority[role]) return highest;
    if (!highest || rolePriority[role] > rolePriority[highest]) return role;
    return highest;
  }, null);

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { user } = await getRequestUser(req);
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: {} } },
    );

    const [profileResult, rolesResult] = await Promise.all([
      adminClient.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      adminClient.from("user_roles").select("role").eq("user_id", user.id),
    ]);

    if (profileResult.error) throw profileResult.error;
    if (rolesResult.error) throw rolesResult.error;

    const roles = (rolesResult.data ?? []).map(({ role }) => role).filter(Boolean);

    return new Response(
      JSON.stringify({
        profile: profileResult.data ?? null,
        roles,
        role: getHighestRole(roles),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    const message = error?.message ?? "Unable to load account access";
    const status = message === "Unauthorized" || message === "Missing authorization header" ? 401 : 500;

    return new Response(JSON.stringify({ message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});