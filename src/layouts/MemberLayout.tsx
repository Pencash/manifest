import { useEffect, ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { memberNavItems } from "@/config/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileFAB } from "@/components/MobileFAB";
import { HandHeart, MessageSquare, Heart } from "lucide-react";
import { useMobilizationReminder } from "@/hooks/useMobilizationReminder";
import { useAuth } from "@/contexts/AuthContext";
import { hasAdminAccess } from "@/lib/roles";

interface MemberLayoutProps {
  children: ReactNode;
}

const MemberLayout = ({ children }: MemberLayoutProps) => {
  const { user, profile, role, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Show mobilization reminder on login
  useMobilizationReminder(user?.id ?? null);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate("/member/auth");
      return;
    }

    // Redirect admins to admin dashboard
    if (hasAdminAccess(role)) {
      navigate("/admin/dashboard");
    }
  }, [user, role, loading, navigate]);

  if (loading || !user) {
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

export default MemberLayout;
