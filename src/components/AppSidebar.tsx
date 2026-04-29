import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { LogOut, Menu } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { NotificationBadge } from "@/components/NotificationBadge";
import { supabase } from "@/integrations/supabase/client";
import { adminNavItems } from "@/config/navigation";
import { hasAdminAccess } from "@/lib/roles";
import { subscribeToNotificationRefresh } from "@/lib/notification-events";
import { buildRestrictedFundMonths, summarizeRestrictedFunds } from "@/lib/restricted-funds";
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
import { Separator } from "@/components/ui/separator";

interface NavItemWithCount {
  label: string;
  path: string;
  icon: any;
  notificationCount?: number;
}

export function AppSidebar() {
  const location = useLocation();
  const { state, isMobile, openMobile, setOpenMobile } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [navItems, setNavItems] = useState<NavItemWithCount[]>(adminNavItems);
  const [userName, setUserName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");

  const loadUserInfo = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (profileData) setUserName(profileData.full_name);
    setUserEmail(user.email || "");
  }, []);

  const loadNotificationCounts = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();
      if (!roleData || !hasAdminAccess(roleData.role)) { setNavItems(adminNavItems); return; }

      const { count: pendingGivingsCount } = await supabase.from("givings").select("*", { count: 'exact', head: true }).eq("status", "pending");
      const { count: pendingExpensesCount } = await supabase.from("expense_requests").select("id", { count: "exact", head: true }).eq("status", "pending");
      const { data: pendingServices } = await supabase.from("services").select("id").eq("approval_status", "pending_admin_approval");
      const [{ data: restrictedGivings }, { data: restrictedRemittances }] = await Promise.all([
        supabase.from("givings").select("amount, created_at, status, giving_types(name)").eq("status", "verified"),
        (supabase as any).from("restricted_fund_remittances").select("*")
      ]);
      const remittanceSummary = summarizeRestrictedFunds(buildRestrictedFundMonths(restrictedGivings || [], restrictedRemittances || []));

      const updatedItems = adminNavItems.map(item => {
        if (item.path === "/admin/financial/verification") return { ...item, notificationCount: pendingGivingsCount || 0 };
        if (item.path === "/admin/financial/remittances") return { ...item, notificationCount: remittanceSummary.pendingMonthCount || 0 };
        if (item.path === "/admin/expenses/pending") return { ...item, notificationCount: pendingExpensesCount || 0 };
        if (item.path === "/admin/pending-services") return { ...item, notificationCount: pendingServices?.length || 0 };
        return item;
      });
      setNavItems(updatedItems);
    } catch (error) {
      console.error("Error loading notification counts:", error);
      setNavItems(adminNavItems);
    }
  }, []);

  useEffect(() => { loadUserInfo(); }, [loadUserInfo]);

  useEffect(() => {
    if (isMobile && openMobile) setOpenMobile(false);
  }, [isMobile, location.pathname]);

  useEffect(() => {
    loadNotificationCounts();
    const givingsChannel = supabase.channel('givings-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'givings' }, loadNotificationCounts).subscribe();
    const expensesChannel = supabase.channel('expenses-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'expense_requests' }, loadNotificationCounts).subscribe();
    const servicesChannel = supabase.channel('services-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, loadNotificationCounts).subscribe();
    const remittancesChannel = supabase.channel('restricted-remittances-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'restricted_fund_remittances' }, loadNotificationCounts).subscribe();
    const unsubscribeFromEvents = subscribeToNotificationRefresh(loadNotificationCounts);
    return () => { supabase.removeChannel(givingsChannel); supabase.removeChannel(expensesChannel); supabase.removeChannel(servicesChannel); supabase.removeChannel(remittancesChannel); unsubscribeFromEvents(); };
  }, [loadNotificationCounts]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    window.location.href = "/";
  };

  const financialItems = navItems.filter(item => ["/admin/financial/verification", "/admin/financial/offline-giving", "/admin/financial/remittances", "/admin/reports/financial"].includes(item.path));
  const expenseItems = navItems.filter(item => item.path.startsWith("/admin/expenses"));
  const eventsItems = navItems.filter(item => ["/admin/events", "/admin/pending-services", "/admin/reports/attendance"].includes(item.path));
  const adminItems = navItems.filter(item => ["/admin/users", "/admin/mobilization"].includes(item.path));
  const conversionItem = navItems.find(item => item.path === "/admin/conversions");
  const dashboardItem = navItems.find(item => item.path === "/admin/dashboard");

  const handleMenuSelect = () => {
    if (isMobile) setTimeout(() => setOpenMobile(false), 150);
  };

  const renderMenuItem = (item: NavItemWithCount) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    return (
      <SidebarMenuItem key={item.path}>
        <SidebarMenuButton asChild isActive={isActive}>
          <NavLink
            to={item.path}
            className="relative flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-lg transition-all duration-200 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            onClick={handleMenuSelect}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span className="flex-1 text-sm">{item.label}</span>}
            {item.notificationCount !== undefined && item.notificationCount > 0 && (
              !isCollapsed ? (
                <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-accent px-1.5 text-[0.625rem] font-bold text-accent-foreground">
                  {item.notificationCount > 99 ? "99+" : item.notificationCount}
                </span>
              ) : (
                <NotificationBadge count={item.notificationCount} />
              )
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const renderGroup = (label: string, items: NavItemWithCount[]) => {
    if (items.length === 0) return null;
    return (
      <SidebarGroup>
        <SidebarGroupLabel className="text-[0.65rem] uppercase tracking-widest text-sidebar-foreground/40 font-semibold px-3">
          {label}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>{items.map(renderMenuItem)}</SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="border-r-0">
      <SidebarHeader className="px-4 py-5 border-b border-sidebar-border/30">
        {!isCollapsed ? (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-accent-foreground font-bold text-sm font-display">P</span>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-sidebar-foreground font-display tracking-tight">Phaneroo</h2>
              <p className="text-[0.6rem] text-sidebar-foreground/50 uppercase tracking-wider">Admin Portal</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-accent-foreground font-bold text-sm font-display">P</span>
            </div>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2 py-3 space-y-1">
        {dashboardItem && (
          <>
            <SidebarGroup>
              <SidebarMenu>{renderMenuItem(dashboardItem)}</SidebarMenu>
            </SidebarGroup>
            <Separator className="my-1 bg-sidebar-border/20" />
          </>
        )}

        {conversionItem && (
          <>
            <SidebarGroup>
              <SidebarMenu>{renderMenuItem(conversionItem)}</SidebarMenu>
            </SidebarGroup>
            <Separator className="my-1 bg-sidebar-border/20" />
          </>
        )}

        {renderGroup("Financial", financialItems)}
        <Separator className="my-1 bg-sidebar-border/20" />
        {renderGroup("Expenses", expenseItems)}
        <Separator className="my-1 bg-sidebar-border/20" />
        {renderGroup("Events", eventsItems)}
        <Separator className="my-1 bg-sidebar-border/20" />
        {renderGroup("Admin", adminItems)}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/30 p-3">
        {!isCollapsed ? (
          <div className="space-y-3">
            <div className="px-2">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{userName || "User"}</p>
              <p className="text-[0.65rem] text-sidebar-foreground/50 truncate">{userEmail}</p>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 text-sm"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="icon" className="w-full text-sidebar-foreground/60 hover:text-sidebar-foreground" onClick={handleSignOut} title="Sign Out">
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
