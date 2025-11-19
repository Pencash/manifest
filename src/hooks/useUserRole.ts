import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export const useUserRole = (userId: string | undefined) => {
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setRole(null);
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
        if (data) {
          setRole(data);
        } else {
          // Fallback to member if no role found (shouldn't happen with auto-assignment)
          setRole("member");
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        // On error, set to null instead of silently downgrading to member
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
