import { supabase } from "@/integrations/supabase/client";
import { fetchCurrentUserAccess } from "@/lib/auth-access";
import { hasAdminAccess, type AppRole } from "@/lib/roles";

export const getCurrentAdminAccess = async () => {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return { user: null, profile: null, role: null as AppRole | null, isAdmin: false };
  }

  const access = await fetchCurrentUserAccess(session.user.id);
  return {
    user: session.user,
    profile: access.profile,
    role: access.role,
    isAdmin: hasAdminAccess(access.role),
  };
};