import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";
import { getCorsHeaders } from "../_shared/security.ts";

type LoginAttemptRequest = {
  email?: string;
  success?: boolean;
  mode?: "check" | "log";
};

const normalizeEmail = (email: string | undefined) => email?.trim().toLowerCase() ?? "";

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: LoginAttemptRequest = await req.json();
    const email = normalizeEmail(payload.email);

    if (!email || email.length < 3 || email.length > 320) {
      return new Response(JSON.stringify({ message: "Invalid email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: {} } },
    );

    if (payload.mode === "log") {
      const { error } = await adminClient
        .from("login_attempts")
        .insert({ email, success: Boolean(payload.success), ip_address: null });

      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count, error } = await adminClient
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .eq("success", false)
      .gte("attempted_at", windowStart);

    if (error) throw error;

    return new Response(JSON.stringify({ limited: (count || 0) >= 5 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    // Fail open: rate-limit bookkeeping must never block or break sign-in.
    console.error("log-login-attempt failed:", error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({ ok: false, limited: false, degraded: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});