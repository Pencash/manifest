import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

// In-memory cache to avoid redundant RPC calls
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
        // Use the secure RPC function instead of direct table query
        const { data, error } = await supabase.rpc("get_user_role", { 
          _user_id: userId 
        });

        console.log("useUserRole fetch:", { userId, role: data, error });

        if (error) throw error;

        // get_user_role returns an app_role or null
        const finalRole: AppRole = data ?? "member";
        roleCache.set(userId, finalRole);
        setRole(finalRole);
      } catch (error) {
        console.error("Error fetching user role (RPC):", error);
        // Fallback to direct table query if RPC fails
      try {
        const { data: fallbackData, error: tableError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);

        if (tableError) throw tableError;
        
        const fallbackRole: AppRole = fallbackData && fallbackData.length > 0 
          ? fallbackData[0].role 
          : "member";
        roleCache.set(userId, fallbackRole);
        setRole(fallbackRole);
        } catch (fallbackError) {
          console.error("Error fetching user role (fallback):", fallbackError);
          setRole(null);
        }
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
