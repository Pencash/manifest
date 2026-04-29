import { supabase } from "@/integrations/supabase/client";

export const useRateLimiting = () => {
  const checkRateLimit = async (email: string): Promise<boolean> => {
    try {
      const windowStart = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from('login_attempts')
        .select('id', { count: 'exact', head: true })
        .eq('email', email)
        .eq('success', false)
        .gte('attempted_at', windowStart);

      if (error) {
        console.error('Rate limit check error:', error);
        return false;
      }

      return (count || 0) >= 5;
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
