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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import { ArrowLeft, Pencil, Shield, UserCog, UserPlus } from "lucide-react";
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

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "member", label: "Member" },
  { value: "finance", label: "Finance" },
  { value: "pastor", label: "Pastor" },
  { value: "admin", label: "Admin" },
];

const getRoleBadgeVariant = (role: AppRole) => {
  switch (role) {
    case "admin": return "destructive" as const;
    case "pastor": return "default" as const;
    case "finance": return "secondary" as const;
    default: return "outline" as const;
  }
};

const UserManagement = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profiles, setProfiles] = useState<ProfileWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const navigate = useNavigate();
  const { role: currentUserRole, loading: roleLoading } = useUserRole(user?.id);

  // --- Create User Dialog ---
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm, setCreateForm] = useState({
    fullName: "", email: "", phone: "", password: "", confirmPassword: "", role: "member" as AppRole,
  });

  // --- Edit User Dialog ---
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ProfileWithRole | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: "", email: "", phone: "", isActive: true, role: "member" as AppRole,
    newPassword: "", confirmPassword: "",
  });
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const getErrorMessage = useCallback(
    (error: unknown) => error instanceof Error ? error.message : "An unexpected error occurred",
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

      const profilesWithRoles = profilesData?.map((profile) => ({
        ...profile,
        user_roles: rolesData?.filter((r) => r.user_id === profile.id).map((r) => ({ role: r.role })) || [],
      })) || [];

      setProfiles(profilesWithRoles);
    } catch (error) {
      console.error("Error loading profiles:", error);
      toast.error(`Failed to load profiles: ${getErrorMessage(error)}`);
    }
  }, [getErrorMessage]);

  const checkUser = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!session?.user) { navigate("/admin/auth"); return; }
      setUser(session.user);
      await loadProfiles();
    } catch (error) {
      console.error("Error loading user:", error);
      toast.error(`Failed to load user data: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }, [getErrorMessage, loadProfiles, navigate]);

  useEffect(() => { checkUser(); }, [checkUser]);

  // ===== CREATE USER =====
  const handleCreateUser = async () => {
    const { fullName, email, password, confirmPassword, phone, role } = createForm;
    if (!fullName.trim()) { toast.error("Full name is required"); return; }
    if (!email.trim()) { toast.error("Email is required"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (password !== confirmPassword) { toast.error("Passwords do not match"); return; }

    setCreateLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { email: email.trim(), password, fullName: fullName.trim(), phone: phone.trim(), role },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || "Creation failed");

      toast.success(`User "${fullName.trim()}" created successfully`);
      setCreateOpen(false);
      setCreateForm({ fullName: "", email: "", phone: "", password: "", confirmPassword: "", role: "member" });
      await loadProfiles();
    } catch (error: any) {
      toast.error(error?.message || "Failed to create user");
    } finally {
      setCreateLoading(false);
    }
  };

  // ===== OPEN EDIT DIALOG =====
  const openEditDialog = (profile: ProfileWithRole) => {
    const userRole = profile.user_roles?.[0]?.role || "member";
    setEditTarget(profile);
    setEditForm({
      fullName: profile.full_name,
      email: profile.email || "",
      phone: profile.phone || "",
      isActive: profile.is_active,
      role: userRole,
      newPassword: "",
      confirmPassword: "",
    });
    setDeleteConfirm(false);
    setEditOpen(true);
  };

  // ===== SAVE PROFILE CHANGES =====
  const handleSaveProfile = async () => {
    if (!editTarget) return;
    if (!editForm.fullName.trim()) { toast.error("Full name is required"); return; }

    setEditLoading(true);
    try {
      // Update profile fields
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: editForm.fullName.trim(),
          phone: editForm.phone.trim() || null,
          is_active: editForm.isActive,
        })
        .eq("id", editTarget.id);
      if (profileError) throw profileError;

      // Update role if changed
      const currentRole = editTarget.user_roles?.[0]?.role || "member";
      if (editForm.role !== currentRole) {
        await supabase.from("user_roles").delete().eq("user_id", editTarget.id);
        const { error: roleError } = await supabase.from("user_roles").insert({
          user_id: editTarget.id,
          role: editForm.role,
          assigned_by: user?.id,
        });
        if (roleError) throw roleError;

        // Send notification
        try {
          await supabase.functions.invoke("send-role-notification", {
            body: {
              email: editTarget.email,
              name: editForm.fullName.trim(),
              newRole: editForm.role,
              userId: editTarget.id,
              assignedBy: user?.id,
            },
          });
        } catch { /* non-fatal */ }
      }

      toast.success("Profile updated successfully");
      await loadProfiles();
    } catch (error) {
      toast.error(`Failed to update profile: ${getErrorMessage(error)}`);
    } finally {
      setEditLoading(false);
    }
  };

  // ===== CHANGE PASSWORD =====
  const handleChangePassword = async () => {
    if (!editTarget) return;
    if (editTarget.id === user?.id) { toast.error("Use account settings to change your own password"); return; }
    if (editForm.newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (editForm.newPassword !== editForm.confirmPassword) { toast.error("Passwords do not match"); return; }

    setEditLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-update-user-password", {
        body: { userId: editTarget.id, newPassword: editForm.newPassword },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || "Failed to update password");

      toast.success(`Password updated for ${editTarget.full_name}`);
      setEditForm((prev) => ({ ...prev, newPassword: "", confirmPassword: "" }));
    } catch (error: any) {
      toast.error(error?.message || "Failed to update password");
    } finally {
      setEditLoading(false);
    }
  };

  // ===== DELETE USER =====
  const handleDeleteUser = async () => {
    if (!editTarget) return;
    if (editTarget.id === user?.id) { toast.error("You cannot delete your own account"); return; }

    setEditLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { userId: editTarget.id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || "Deletion failed");

      toast.success("User deleted successfully");
      setEditOpen(false);
      setEditTarget(null);
      await loadProfiles();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete user");
    } finally {
      setEditLoading(false);
    }
  };

  // ===== FILTERING =====
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
      return [profile.full_name, profile.email || "", profile.phone || "", userRole]
        .join(" ").toLowerCase().includes(query);
    });
  }, [profiles, roleFilter, searchQuery, statusFilter]);

  // ===== TABLE ROWS =====
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
            <Button variant="outline" size="sm" onClick={() => openEditDialog(profile)}>
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
          ),
        };
      }),
    [filteredProfiles, user?.id],
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
            <Button onClick={() => navigate("/admin/dashboard")}>Return to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSelf = editTarget?.id === user?.id;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/5 to-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <UserCog className="h-6 w-6 text-primary" />
              <h1 className="text-2xl md:text-3xl font-bold">User Management</h1>
            </div>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" /> Add User
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" /> Manage Users
            </CardTitle>
            <CardDescription>View, create, edit, and manage user accounts and roles.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveDataView
              columns={["Name", "Email", "Phone", "Role", "Status"]}
              rows={rows}
              controls={
                <div className="grid gap-3 md:grid-cols-3">
                  <Input
                    placeholder="Search name, email, phone"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger><SelectValue placeholder="All roles" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All roles</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="pastor">Pastor</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
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

      {/* ===== CREATE USER DIALOG ===== */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new user account. They will be able to sign in immediately.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="create-name">Full Name *</Label>
              <Input id="create-name" value={createForm.fullName} onChange={(e) => setCreateForm((p) => ({ ...p, fullName: e.target.value }))} placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">Email *</Label>
              <Input id="create-email" type="email" value={createForm.email} onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))} placeholder="john@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-phone">Phone (optional)</Label>
              <Input id="create-phone" value={createForm.phone} onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+265..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="create-password">Password *</Label>
                <Input id="create-password" type="password" value={createForm.password} onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))} placeholder="Min 6 chars" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-confirm">Confirm *</Label>
                <Input id="create-confirm" type="password" value={createForm.confirmPassword} onChange={(e) => setCreateForm((p) => ({ ...p, confirmPassword: e.target.value }))} placeholder="Repeat" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={createForm.role} onValueChange={(v) => setCreateForm((p) => ({ ...p, role: v as AppRole }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateUser} disabled={createLoading}>
              {createLoading ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== EDIT USER DIALOG ===== */}
      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) setEditTarget(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>{editTarget?.full_name || "User details"}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Profile Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Profile</h3>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input id="edit-name" value={editForm.fullName} onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" value={editForm.email} disabled className="opacity-60" />
                <p className="text-xs text-muted-foreground">Email cannot be changed from here.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input id="edit-phone" value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-active">Active Status</Label>
                <Switch id="edit-active" checked={editForm.isActive} onCheckedChange={(v) => setEditForm((p) => ({ ...p, isActive: v }))} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={editForm.role} onValueChange={(v) => setEditForm((p) => ({ ...p, role: v as AppRole }))} disabled={isSelf}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {isSelf && <p className="text-xs text-muted-foreground">You cannot change your own role.</p>}
              </div>
              <Button onClick={handleSaveProfile} disabled={editLoading} className="w-full">
                {editLoading ? "Saving..." : "Save Profile"}
              </Button>
            </div>

            <Separator />

            {/* Security Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Security</h3>
              {isSelf ? (
                <p className="text-sm text-muted-foreground">Use your account settings to change your own password.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="edit-password">New Password</Label>
                      <Input id="edit-password" type="password" value={editForm.newPassword} onChange={(e) => setEditForm((p) => ({ ...p, newPassword: e.target.value }))} placeholder="Min 6 chars" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-confirm-pw">Confirm</Label>
                      <Input id="edit-confirm-pw" type="password" value={editForm.confirmPassword} onChange={(e) => setEditForm((p) => ({ ...p, confirmPassword: e.target.value }))} placeholder="Repeat" />
                    </div>
                  </div>
                  <Button variant="secondary" onClick={handleChangePassword} disabled={editLoading || !editForm.newPassword} className="w-full">
                    {editLoading ? "Updating..." : "Update Password"}
                  </Button>
                </>
              )}
            </div>

            <Separator />

            {/* Danger Zone */}
            {!isSelf && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-destructive uppercase tracking-wide">Danger Zone</h3>
                {!deleteConfirm ? (
                  <Button variant="destructive" className="w-full" onClick={() => setDeleteConfirm(true)}>
                    Delete This User
                  </Button>
                ) : (
                  <div className="space-y-2 p-3 border border-destructive/30 rounded-md bg-destructive/5">
                    <p className="text-sm text-destructive font-medium">Are you sure? This action cannot be undone.</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(false)} className="flex-1">Cancel</Button>
                      <Button variant="destructive" size="sm" onClick={handleDeleteUser} disabled={editLoading} className="flex-1">
                        {editLoading ? "Deleting..." : "Confirm Delete"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
