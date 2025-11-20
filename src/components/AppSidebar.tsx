import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronDown, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { NotificationBadge } from "@/components/NotificationBadge";
import { supabase } from "@/integrations/supabase/client";
import { adminNavItems } from "@/config/navigation";
import { hasAdminAccess } from "@/lib/roles";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";

interface NavItemWithCount {
  label: string;
  path: string;
  icon: any;
  notificationCount?: number;
}

export function AppSidebar() {
  const location = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [navItems, setNavItems] = useState<NavItemWithCount[]>(adminNavItems);
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");

  // Load user info
  useEffect(() => {
    loadUserInfo();
  }, []);

  // Load notification counts with realtime updates
  useEffect(() => {
    loadNotificationCounts();
    
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

    return () => {
      supabase.removeChannel(givingsChannel);
      supabase.removeChannel(expensesChannel);
      supabase.removeChannel(servicesChannel);
    };
  }, []);

  const loadUserInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileData) {
      setUserName(profileData.full_name);
    }
    setUserEmail(user.email || "");
  };

  const loadNotificationCounts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (!roleData || !hasAdminAccess(roleData.role)) {
        setNavItems(adminNavItems);
        return;
      }

      // Count pending givings
      const { data: pendingGivings } = await supabase
        .from("givings")
        .select("id, status, service_id, services!inner(approval_status)")
        .or("status.eq.pending,services.approval_status.eq.pending_admin_approval");

      // Count pending expense requests
      const { data: pendingExpenses } = await supabase
        .from("expense_requests")
        .select("id")
        .in("status", ["pending_approval", "draft"]);

      // Count pending service events
      const { data: pendingServices } = await supabase
        .from("services")
        .select("id")
        .eq("approval_status", "pending_admin_approval");

      const pendingGivingsCount = pendingGivings?.length || 0;
      const pendingExpensesCount = pendingExpenses?.length || 0;
      const pendingServicesCount = pendingServices?.length || 0;

      const updatedItems = adminNavItems.map(item => {
        if (item.path === "/admin/givings") {
          return { ...item, notificationCount: pendingGivingsCount };
        }
        if (item.path === "/admin/expenses/pending") {
          return { ...item, notificationCount: pendingExpensesCount };
        }
        if (item.path === "/admin/pending-services") {
          return { ...item, notificationCount: pendingServicesCount };
        }
        return item;
      });

      setNavItems(updatedItems);
    } catch (error) {
      console.error("Error loading notification counts:", error);
      setNavItems(adminNavItems);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    window.location.href = "/";
  };

  // Group items by category
  const financialItems = navItems.filter(item => 
    ["/admin/givings", "/admin/reports/financial"].includes(item.path)
  );

  const expenseItems = navItems.filter(item => 
    item.path.startsWith("/admin/expenses")
  );

  const eventsItems = navItems.filter(item => 
    ["/admin/events", "/admin/pending-services", "/admin/reports/attendance"].includes(item.path)
  );

  const adminItems = navItems.filter(item => 
    ["/admin/users", "/admin/mobilization"].includes(item.path)
  );

  const dashboardItem = navItems.find(item => item.path === "/admin/dashboard");

  const renderMenuItem = (item: NavItemWithCount) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;

    return (
      <SidebarMenuItem key={item.path}>
        <SidebarMenuButton asChild isActive={isActive}>
          <NavLink 
            to={item.path}
            className="relative flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-accent"
            activeClassName="bg-accent text-accent-foreground font-medium"
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span className="flex-1">{item.label}</span>}
            {item.notificationCount !== undefined && item.notificationCount > 0 && (
              <div className={isCollapsed ? "absolute -top-1 -right-1" : ""}>
                <NotificationBadge count={item.notificationCount} />
              </div>
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-4 py-4">
        {!isCollapsed && (
          <h2 className="text-lg font-semibold text-foreground">Admin Portal</h2>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        {/* Dashboard */}
        {dashboardItem && (
          <>
            <SidebarGroup>
              <SidebarMenu>
                {renderMenuItem(dashboardItem)}
              </SidebarMenu>
            </SidebarGroup>
            <Separator className="my-2" />
          </>
        )}

        {/* Financial Management */}
        <SidebarGroup>
          <SidebarGroupLabel>Financial</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {financialItems.map(renderMenuItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="my-2" />

        {/* Expense Management */}
        <SidebarGroup>
          <SidebarGroupLabel>Expenses</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {expenseItems.map(renderMenuItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="my-2" />

        {/* Events & Attendance */}
        <SidebarGroup>
          <SidebarGroupLabel>Events</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {eventsItems.map(renderMenuItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="my-2" />

        {/* Administration */}
        <SidebarGroup>
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map(renderMenuItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        {!isCollapsed ? (
          <div className="space-y-3">
            <div className="px-2">
              <p className="text-sm font-medium text-foreground truncate">{userName || "User"}</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
            </div>
            <Button 
              variant="outline" 
              className="w-full justify-start gap-2" 
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        ) : (
          <Button 
            variant="ghost" 
            size="icon" 
            className="w-full" 
            onClick={handleSignOut}
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
