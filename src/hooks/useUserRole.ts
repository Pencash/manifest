import { useEffect, useState } from "react";
import { Database } from "@/integrations/supabase/types";
import { fetchCurrentUserAccess } from "@/lib/auth-access";

type AppRole = Database["public"]["Enums"]["app_role"];

// In-memory cache to avoid redundant role queries
const roleCache = new Map<string, AppRole>();

export const useUserRole = (userId: string | undefined) => {
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setRole(null);
      setLoading(false);
      return;
    }

    // Check cache first
    const cached = roleCache.get(userId);
    if (cached) {
      setRole(cached);
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      try {
        const { role } = await fetchCurrentUserAccess(userId);
        const fallbackRole: AppRole = role ?? "member";
        roleCache.set(userId, fallbackRole);
        setRole(fallbackRole);
      } catch (fallbackError) {
        console.error("Error fetching user role:", fallbackError);
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, [userId]);

  return { role, loading };
};

export const hasRole = (userRole: AppRole | null, requiredRole: AppRole): boolean => {
  if (!userRole) return false;
  
  const roleHierarchy: Record<AppRole, number> = {
    admin: 4,
    pastor: 3,
    finance: 2,
    member: 1,
  };

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
};
