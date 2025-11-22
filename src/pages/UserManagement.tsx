import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const navigate = useNavigate();
  const { role: currentUserRole, loading: roleLoading } = useUserRole(user?.id);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate("/admin/auth");
        return;
      }
      
      setUser(session.user);
      await loadProfiles();
    } catch (error: any) {
      console.error("Error loading user:", error);
      toast.error("Failed to load user data");
    } finally {
      setLoading(false);
    }
  };

  const loadProfiles = async () => {
    try {
      // Fetch profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, created_at, is_active")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Combine profiles with their roles
      const profilesWithRoles = profilesData?.map(profile => ({
        ...profile,
        user_roles: rolesData?.filter(r => r.user_id === profile.id).map(r => ({ role: r.role })) || []
      })) || [];

      setProfiles(profilesWithRoles);
    } catch (error: any) {
      console.error("Error loading profiles:", error);
      toast.error("Failed to load profiles");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this user? This action cannot be undone.");

    if (!confirmDelete) return;

    setActionInProgress(userId);

    try {
      const { error: rolesError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (rolesError) throw rolesError;

      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);

      if (profileError) throw profileError;

      toast.success("User deleted successfully");
      await loadProfiles();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleResetPassword = async (profile: ProfileWithRole) => {
    if (!profile.email) {
      toast.error("User does not have a valid email");
      return;
    }

    setActionInProgress(profile.id);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
        redirectTo: `${window.location.origin}/member/auth`,
      });

      if (error) throw error;

      toast.success("Password reset email sent");
    } catch (error: any) {
      console.error("Error resetting password:", error);
      toast.error("Failed to send reset email");
    } finally {
      setActionInProgress(null);
    }
  };

  const updateUserRole = async (userId: string, newRole: AppRole) => {
    try {
      // Get user's email for notification
      const profile = profiles.find(p => p.id === userId);
      
      // First, delete existing roles for this user
      await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      // Then insert the new role
      const { error } = await supabase
        .from("user_roles")
        .insert({
          user_id: userId,
          role: newRole,
          assigned_by: user?.id,
        });

      if (error) throw error;

      // Call edge function to send role change notification
      try {
        await supabase.functions.invoke('send-role-notification', {
          body: {
            email: profile?.email,
            name: profile?.full_name,
            newRole: newRole,
            userId: userId,
            assignedBy: user?.id
          }
        });
      } catch (emailError) {
        console.error("Failed to send notification email:", emailError);
        // Don't fail the role update if email fails
      }

      toast.success(`User role updated to ${newRole}. Notification sent.`);
      await loadProfiles();
    } catch (error: any) {
      console.error("Error updating role:", error);
      toast.error("Failed to update user role");
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
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Current Role</TableHead>
                    <TableHead>Change Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => {
                    const userRole = profile.user_roles?.[0]?.role || "member";
                    return (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium">{profile.full_name}</TableCell>
                        <TableCell>{profile.email || "N/A"}</TableCell>
                        <TableCell>{profile.phone || "N/A"}</TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(userRole)}>
                            {userRole}
                          </Badge>
                        </TableCell>
                        <TableCell>
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
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge variant={profile.is_active ? "default" : "secondary"}>
                            {profile.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="space-x-2 text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={actionInProgress === profile.id || profile.id === user?.id}
                            onClick={() => handleResetPassword(profile)}
                          >
                            Reset Password
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={actionInProgress === profile.id || profile.id === user?.id}
                            onClick={() => handleDeleteUser(profile.id)}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserManagement;
