const REQUIRED_SUPABASE_ENV_VARS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
] as const;

export type SupabaseEnvVar = typeof REQUIRED_SUPABASE_ENV_VARS[number];

export const getMissingSupabaseEnvVars = (): SupabaseEnvVar[] =>
  REQUIRED_SUPABASE_ENV_VARS.filter((key) =>
    !String(import.meta.env[key] ?? "").trim()
  );
