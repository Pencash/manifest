import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveDataView, type ResponsiveDataViewRow } from "@/components/ResponsiveDataView";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import { ArrowLeft, Shield, UserCog } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface ProfileWithRole {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  is_active: boolean;
  user_roles: { role: AppRole }[];
}

const UserManagement = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profiles, setProfiles] = useState<ProfileWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<ProfileWithRole | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const navigate = useNavigate();
  const { role: currentUserRole, loading: roleLoading } = useUserRole(user?.id);

  const getErrorMessage = useCallback(
    (error: unknown) =>
      error instanceof Error ? error.message : "An unexpected error occurred",
    []
  );

  const loadProfiles = useCallback(async () => {
    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, created_at, is_active")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      const profilesWithRoles =
        profilesData?.map((profile) => ({
          ...profile,
          user_roles:
            rolesData
              ?.filter((role) => role.user_id === profile.id)
              .map((role) => ({ role: role.role })) || [],
        })) || [];

      setProfiles(profilesWithRoles);
    } catch (error) {
      console.error("Error loading profiles:", error);
      toast.error(`Failed to load profiles: ${getErrorMessage(error)}`);
    }
  }, [getErrorMessage]);

  const checkUser = useCallback(async () => {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) throw error;

      if (!session?.user) {
        navigate("/admin/auth");
        return;
      }

      setUser(session.user);
      await loadProfiles();
    } catch (error) {
      console.error("Error loading user:", error);
      toast.error(`Failed to load user data: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }, [getErrorMessage, loadProfiles, navigate]);

  useEffect(() => {
    checkUser();
  }, [checkUser]);


  const handleDeleteUser = async (userId: string) => {
    if (userId === user?.id) {
      toast.error("You cannot delete your own account");
      return;
    }

    const confirmDelete = window.confirm("Are you sure you want to delete this user? This action cannot be undone.");

    if (!confirmDelete) return;

    setActionInProgress(userId);

    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { userId },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.message || "Deletion failed");
      }

      toast.success("User deleted successfully");
      await loadProfiles();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(error?.message || "Failed to delete user");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleResetPassword = async (profile: ProfileWithRole) => {
    setPasswordTarget(profile);
    setNewPassword("");
    setConfirmPassword("");
    setPasswordDialogOpen(true);
  };

  const handleSetPassword = async () => {
    if (!passwordTarget) return;

    if (passwordTarget.id === user?.id) {
      toast.error("Use account settings to update your own password");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setSavingPassword(true);

    try {
      const { data, error } = await supabase.functions.invoke("admin-update-user-password", {
        body: { userId: passwordTarget.id, newPassword },
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.message || "Failed to update password");
      }

      toast.success(`Password updated for ${passwordTarget.full_name}`);
      setPasswordDialogOpen(false);
      setPasswordTarget(null);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Error updating password:", error);
      toast.error(error?.message || "Failed to update password");
    } finally {
      setSavingPassword(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: AppRole) => {
    try {
      const profile = profiles.find((p) => p.id === userId);

      if (!profile) {
        toast.error("User profile not found");
        return;
      }

      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      const { error } = await supabase
        .from("user_roles")
        .insert({
          user_id: userId,
          role: newRole,
          assigned_by: user?.id,
        });

      if (error) throw error;

      try {
        await supabase.functions.invoke("send-role-notification", {
          body: {
            email: profile?.email,
            name: profile?.full_name,
            newRole: newRole,
            userId: userId,
            assignedBy: user?.id,
          },
        });
      } catch (emailError) {
        console.error("Failed to send notification email:", emailError);
      }

      toast.success(`User role updated to ${newRole}. Notification sent.`);
      await loadProfiles();
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error(`Failed to update user role: ${getErrorMessage(error)}`);
    }
  };

  const getRoleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "pastor":
        return "default";
      case "finance":
        return "secondary";
      default:
        return "outline";
    }
  };

  const filteredProfiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return profiles.filter((profile) => {
      const userRole = profile.user_roles?.[0]?.role || "member";
      const matchesRole = roleFilter === "all" || userRole === roleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && profile.is_active) ||
        (statusFilter === "inactive" && !profile.is_active);

      if (!matchesRole || !matchesStatus) return false;
      if (!query) return true;

      return [
        profile.full_name,
        profile.email || "",
        profile.phone || "",
        userRole,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [profiles, roleFilter, searchQuery, statusFilter]);

  const rows: ResponsiveDataViewRow[] = useMemo(
    () =>
      filteredProfiles.map((profile) => {
        const userRole = profile.user_roles?.[0]?.role || "member";
        return {
          id: profile.id,
          title: profile.full_name,
          subtitle: profile.email || "No email",
          desktopCells: [
            <span className="font-medium">{profile.full_name}</span>,
            profile.email || "N/A",
            profile.phone || "N/A",
            <Badge variant={getRoleBadgeVariant(userRole)}>{userRole}</Badge>,
            <Select
              value={userRole}
              onValueChange={(value) => updateUserRole(profile.id, value as AppRole)}
              disabled={profile.id === user?.id}
            >
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="finance">Finance</SelectItem>
                <SelectItem value="pastor">Pastor</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>,
            <Badge variant={profile.is_active ? "default" : "secondary"}>
              {profile.is_active ? "Active" : "Inactive"}
            </Badge>,
          ],
          essentials: [
            { label: "Status", value: <Badge variant={profile.is_active ? "default" : "secondary"}>{profile.is_active ? "Active" : "Inactive"}</Badge> },
            { label: "Person", value: profile.full_name },
            { label: "Role", value: <Badge variant={getRoleBadgeVariant(userRole)}>{userRole}</Badge> },
            { label: "Date", value: new Date(profile.created_at).toLocaleDateString() },
          ],
          details: [
            { label: "Email", value: profile.email || "N/A" },
            { label: "Phone", value: profile.phone || "N/A" },
          ],
          actions: (
            <>
              <Button
                variant="secondary"
                size="sm"
                disabled={actionInProgress === profile.id || profile.id === user?.id}
                onClick={() => handleResetPassword(profile)}
              >
                Change Password
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={actionInProgress === profile.id || profile.id === user?.id}
                onClick={() => handleDeleteUser(profile.id)}
              >
                Delete
              </Button>
            </>
          ),
        };
      }),
    [actionInProgress, filteredProfiles, getRoleBadgeVariant, handleDeleteUser, updateUserRole, user?.id],
  );

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (currentUserRole !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Only administrators can access user management.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/admin/dashboard")}>
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/5 to-background">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <UserCog className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">User Management</h1>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Manage User Roles
            </CardTitle>
            <CardDescription>
              Assign and manage user roles. Only admins can perform these actions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveDataView
              columns={["Name", "Email", "Phone", "Current Role", "Change Role", "Status"]}
              rows={rows}
              controls={
                <div className="grid gap-3 md:grid-cols-3">
                  <Input
                    placeholder="Search name, email, phone"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All roles</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="pastor">Pastor</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              }
              emptyState={<p className="py-12 text-center text-muted-foreground">No users match the selected filters.</p>}
            />
          </CardContent>
        </Card>
      </div>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Password</DialogTitle>
            <DialogDescription>
              Set a new password for {passwordTarget?.full_name || "this user"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPasswordDialogOpen(false);
                setPasswordTarget(null);
                setNewPassword("");
                setConfirmPassword("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSetPassword} disabled={savingPassword}>
              {savingPassword ? "Updating..." : "Update Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
