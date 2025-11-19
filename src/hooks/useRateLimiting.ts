import { supabase } from "@/integrations/supabase/client";

export const useRateLimiting = () => {
  const checkRateLimit = async (email: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('is_rate_limited', {
        check_email: email,
        check_ip: null // IP tracking would require edge function
      });

      if (error) {
        console.error('Rate limit check error:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('Rate limit check failed:', error);
      return false;
    }
  };

  const logLoginAttempt = async (email: string, success: boolean): Promise<void> => {
    try {
      await supabase
        .from('login_attempts')
        .insert({
          email,
          success,
          ip_address: null, // IP tracking would require edge function
        });
    } catch (error) {
      console.error('Failed to log login attempt:', error);
    }
  };

  return { checkRateLimit, logLoginAttempt };
};
