import { NavLink } from "@/components/NavLink";
import { UserMenu } from "@/components/UserMenu";
import { NavItem } from "@/config/navigation";
import { NotificationBadge } from "@/components/NotificationBadge";
import { Menu, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { subscribeToNotificationRefresh } from "@/lib/notification-events";

interface NavbarProps {
  items: NavItem[];
  userName?: string;
  userEmail?: string;
}

export const Navbar = ({ items, userName, userEmail }: NavbarProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navItems, setNavItems] = useState<NavItem[]>(items);

  const loadNotificationCounts = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (!roleData || !['admin', 'finance', 'pastor'].includes(roleData.role)) {
        setNavItems(items);
        return;
      }

      // Count pending givings (including those for pending services)
      const { data: pendingGivings } = await supabase
        .from("givings")
        .select("id, status, service_id, services!inner(approval_status)")
        .or("status.eq.pending,services.approval_status.eq.pending_admin_approval");

      // Count pending expense requests
      const { count: pendingExpensesCount } = await supabase
        .from("expense_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");

      // Count pending service events
      const { data: pendingServices } = await supabase
        .from("services")
        .select("id")
        .eq("approval_status", "pending_admin_approval");

      const pendingGivingsCount = pendingGivings?.length || 0;
      const pendingExpensesCountValue = pendingExpensesCount || 0;
      const pendingServicesCount = pendingServices?.length || 0;

      // Update navigation items with counts
      const updatedItems = items.map(item => {
        if (item.path === "/admin/givings") {
          return { ...item, notificationCount: pendingGivingsCount };
        }
        if (item.path === "/admin/expenses/pending") {
          return { ...item, notificationCount: pendingExpensesCountValue };
        }
        if (item.path === "/admin/pending-services") {
          return { ...item, notificationCount: pendingServicesCount };
        }
        return item;
      });

      setNavItems(updatedItems);
    } catch (error) {
      console.error("Error loading notification counts:", error);
      setNavItems(items);
    }
  }, [items]);

  useEffect(() => {
    loadNotificationCounts();
    
    // Set up realtime subscriptions for updates
    const givingsChannel = supabase
      .channel('givings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'givings' }, loadNotificationCounts)
      .subscribe();

    const expensesChannel = supabase
      .channel('expenses-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_requests' }, loadNotificationCounts)
      .subscribe();

    const servicesChannel = supabase
      .channel('services-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, loadNotificationCounts)
      .subscribe();

    const unsubscribeFromEvents = subscribeToNotificationRefresh(loadNotificationCounts);

    return () => {
      supabase.removeChannel(givingsChannel);
      supabase.removeChannel(expensesChannel);
      supabase.removeChannel(servicesChannel);
      unsubscribeFromEvents();
    };
  }, [loadNotificationCounts]);

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-6">
            <NavLink to="/" className="text-xl font-bold text-primary">
              Manifest Malawi
            </NavLink>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground rounded-md hover:bg-accent hover:text-accent-foreground transition-colors relative"
                  activeClassName="bg-accent text-accent-foreground"
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  <NotificationBadge count={item.notificationCount || 0} variant="warning" />
                </NavLink>
              ))}
            </div>
          </div>

          {/* Right Side - User Menu */}
          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <UserMenu userName={userName} userEmail={userEmail} />
            </div>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <div className="flex flex-col gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-muted-foreground rounded-md hover:bg-accent hover:text-accent-foreground transition-colors relative"
                  activeClassName="bg-accent text-accent-foreground"
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                  <NotificationBadge count={item.notificationCount || 0} variant="warning" />
                </NavLink>
              ))}
              <div className="mt-4 pt-4 border-t">
                <div className="px-3 py-2 text-sm">
                  <p className="font-medium">{userName || "User"}</p>
                  <p className="text-xs text-muted-foreground">{userEmail}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};
