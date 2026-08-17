import { supabase } from "@/integrations/supabase/client";

export const useRateLimiting = () => {
  const checkRateLimit = async (email: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('log-login-attempt', {
        body: { email, mode: 'check' },
      });

      // Fail open — never block sign-in because the check is unavailable.
      if (error) return false;

      return Boolean(data?.limited);
    } catch {
      return false;
    }
  };

  const logLoginAttempt = async (email: string, success: boolean): Promise<void> => {
    try {
      await supabase.functions.invoke('log-login-attempt', {
        body: { email, success, mode: 'log' },
      });
    } catch {
      // Non-critical telemetry — ignore failures.
    }
  };

  return { checkRateLimit, logLoginAttempt };
};
