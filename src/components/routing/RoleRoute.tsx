import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import LoadingFallback from "@/components/LoadingFallback";
import { useAuth } from "@/contexts/AuthContext";
import { AppRole, hasAdminAccess } from "@/lib/roles";

interface RoleRouteProps {
  children: ReactNode;
  allowedRoles: AppRole[];
  unauthorizedTo?: string;
  unauthenticatedTo?: string;
}

export const RoleRoute = ({
  children,
  allowedRoles,
  unauthorizedTo = "/dashboard",
  unauthenticatedTo = "/admin/auth",
}: RoleRouteProps) => {
  const { session, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingFallback />;
  }

  if (!session?.user) {
    return <Navigate to={unauthenticatedTo} replace state={{ from: location }} />;
  }

  const currentRole = role ?? "member";
  const isAllowed = allowedRoles.includes(currentRole) || (allowedRoles.includes("admin") && hasAdminAccess(currentRole));

  if (!isAllowed) {
    return <Navigate to={unauthorizedTo} replace />;
  }

  return <>{children}</>;
};
