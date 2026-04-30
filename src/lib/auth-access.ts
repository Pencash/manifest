import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { getHighestRole } from "@/lib/roles";

type AppRole = Database["public"]["Enums"]["app_role"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type CurrentUserAccess = {
  profile: Profile | null;
  role: AppRole | null;
  roles: AppRole[];
};

export const fetchCurrentUserAccess = async (userId: string): Promise<CurrentUserAccess> => {
  const { data, error } = await supabase.functions.invoke("get-current-user-access");

  if (!error && data) {
    return {
      profile: data.profile ?? null,
      role: (data.role as AppRole | null) ?? null,
      roles: (data.roles ?? []) as AppRole[],
    };
  }

  console.error("Secure role lookup failed, falling back to direct role query:", error);

  const [profileResult, roleResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (roleResult.error) throw roleResult.error;

  const roles = roleResult.data?.map(({ role }) => role) ?? [];

  return {
    profile: profileResult.data ?? null,
    role: getHighestRole(roles),
    roles,
  };
};