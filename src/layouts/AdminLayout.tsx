import { useEffect, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { User } from "@supabase/supabase-js";
import { hasAdminAccess } from "@/lib/roles";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";

interface AdminLayoutProps {
  children: ReactNode;
}

export const AdminLayout = ({ children }: AdminLayoutProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/admin/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      navigate("/admin/auth");
      return;
    }

    setUser(session.user);

    // Load profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    setProfile(profileData);

    // Check admin access
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    const mainRole = rolesData && rolesData.length > 0 ? rolesData[0].role : null;

    if (!hasAdminAccess(mainRole)) {
      toast.error("Access denied. Admin privileges required.");
      navigate("/dashboard");
    }
  };

  if (!user) {
    return null;
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center px-4 justify-between">
              <SidebarTrigger />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <div className="container mx-auto px-4 py-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
