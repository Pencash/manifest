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
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .single();

        if (error) throw error;
        setRole(data?.role || "member");
      } catch (error) {
        console.error("Error fetching user role:", error);
        setRole("member");
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
