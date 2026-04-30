import { supabase } from "@/integrations/supabase/client";

export const useRateLimiting = () => {
  const checkRateLimit = async (email: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('log-login-attempt', {
        body: { email, mode: 'check' },
      });

      if (error) {
        console.error('Rate limit check error:', error);
        return false;
      }

      return Boolean(data?.limited);
    } catch (error) {
      console.error('Rate limit check failed:', error);
      return false;
    }
  };

  const logLoginAttempt = async (email: string, success: boolean): Promise<void> => {
    try {
      await supabase.functions.invoke('log-login-attempt', {
        body: { email, success, mode: 'log' },
      });
    } catch (error) {
      console.error('Failed to log login attempt:', error);
    }
  };

  return { checkRateLimit, logLoginAttempt };
};
