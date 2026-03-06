import { createClient } from "https://esm.sh/@supabase/supabase-js@2.83.0";

const parseAllowedOrigins = () =>
  (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

export const getCorsHeaders = (origin: string | null) => {
  const allowedOrigins = parseAllowedOrigins();
  const allowOrigin = allowedOrigins.length === 0
    ? "*"
    : origin && allowedOrigins.includes(origin)
      ? origin
      : allowedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
};

export const assertRequiredFields = <T extends Record<string, unknown>>(
  payload: T,
  fields: Array<keyof T>,
) => {
  const missing = fields.filter((field) => !payload[field]);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(", ")}`);
  }
};

export const getRequestUser = async (req: Request) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Missing authorization header");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  return { user, userClient };
};
