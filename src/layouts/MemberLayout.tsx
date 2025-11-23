import { useEffect, useState, ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { memberNavItems } from "@/config/navigation";
import { User } from "@supabase/supabase-js";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileFAB } from "@/components/MobileFAB";
import { HandHeart, MessageSquare, Heart } from "lucide-react";

interface MemberLayoutProps {
  children: ReactNode;
}

export const MemberLayout = ({ children }: MemberLayoutProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/member/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      navigate("/member/auth");
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

    // Check if user is admin and redirect
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .single();

    if (roleData?.role === 'admin' || roleData?.role === 'finance' || roleData?.role === 'pastor') {
      navigate("/admin/dashboard");
    }
  };

  if (!user) {
    return null;
  }

  // Show FAB only on dashboard, not on forms or auth
  const showFAB = ['/dashboard'].includes(location.pathname);

  const fabActions = [
    {
      icon: HandHeart,
      label: "Give",
      action: () => navigate("/give"),
    },
    {
      icon: Heart,
      label: "Prayer",
      action: () => navigate("/prayer"),
    },
    {
      icon: MessageSquare,
      label: "Testimony",
      action: () => navigate("/testimony"),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-4 right-20 z-50">
        <ThemeToggle />
      </div>
      <Navbar 
        items={memberNavItems} 
        userName={profile?.full_name}
        userEmail={user.email}
      />
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
      {showFAB && <MobileFAB actions={fabActions} />}
    </div>
  );
};
