// src/lib/roles.ts

export type AppRole = "member" | "admin" | "finance" | "pastor";

export const ADMIN_ROLES: AppRole[] = ["admin", "finance", "pastor"];

export function hasAdminAccess(role: string | null | undefined): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase() as AppRole;
  return ADMIN_ROLES.includes(normalized);
}
