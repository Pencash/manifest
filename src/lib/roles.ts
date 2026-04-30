// src/lib/roles.ts

export type AppRole = "member" | "admin" | "finance" | "pastor";

export const ADMIN_ROLES: AppRole[] = ["admin", "finance", "pastor"];
const ROLE_PRIORITY: Record<AppRole, number> = {
  admin: 4,
  pastor: 3,
  finance: 2,
  member: 1,
};

export function hasAdminAccess(role: string | null | undefined): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase() as AppRole;
  return ADMIN_ROLES.includes(normalized);
}

export function getHighestRole(roles: Array<string | null | undefined> | null | undefined): AppRole | null {
  if (!roles?.length) return null;

  return roles.reduce<AppRole | null>((highest, role) => {
    if (!role) return highest;
    const normalized = role.toLowerCase() as AppRole;
    if (!(normalized in ROLE_PRIORITY)) return highest;
    if (!highest || ROLE_PRIORITY[normalized] > ROLE_PRIORITY[highest]) return normalized;
    return highest;
  }, null);
}
