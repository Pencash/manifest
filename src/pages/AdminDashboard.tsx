import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import { Download, DollarSign, Users, AlertCircle, TrendingUp, TrendingDown, Calendar, MessageSquare, ChevronRight, Wallet, HandCoins, CalendarCheck2, Megaphone, ArrowRight } from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from "date-fns";
import { hasAdminAccess } from "@/lib/roles";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAmount } from "@/lib/utils";
import { motion } from "framer-motion";

type TimePeriod = "today" | "week" | "month" | "all";

interface Metrics {
  totalGivings: number;
  previousGivings: number;
  activeMembers: number;
  newMembers: number;
  pendingGivings: number;
  pendingExpenses: number;
  pendingServices: number;
  totalAttendance: number;
  avgAttendance: number;
  testimonies: number;
  prayers: number;
  givingsByType: { name: string; value: number }[];
  givingsTrend: { date: string; cash: number; mobile: number; bank: number; card: number }[];
  attendanceByType: { name: string; count: number }[];
  recentActivity: { type: string; message: string; time: string }[];
  eligibleActivityGivings: number;
  restrictedGivings: number;
  fundedExpenses: number;
  activitySupportFunds: number;
  eventsUpcoming: number;
  eventsInPeriod: number;
  mobilizationInvites: number;
  mobilizationConfirmed: number;
  mobilizationAttended: number;
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }
  })
};

const AdminDashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("month");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState<string>("");
  const [exportEndDate, setExportEndDate] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const navigate = useNavigate();

  const checkUser = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { navigate("/admin/auth"); return; }
      setUser(session.user);
      const { data: profileData, error: profileError } = await supabase.from("profiles").select("full_name").eq("id", session.user.id).single();
      if (profileError) throw profileError;
      setProfile(profileData);
      const { data: rolesData, error: rolesError } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      if (rolesError) throw rolesError;
      const mainRole = rolesData && rolesData.length > 0 ? rolesData[0].role : null;
      if (!hasAdminAccess(mainRole)) { toast.error("Access denied. Admin privileges required."); navigate("/dashboard"); return; }
    } catch (error: any) {
      console.error("Error loading admin profile or role:", error);
      toast.error("Failed to load admin profile");
    } finally { setLoading(false); }
  }, [navigate]);

  const getDateRange = (period: TimePeriod) => {
    const now = new Date();
    switch (period) {
      case "today": return { start: startOfDay(now), end: endOfDay(now) };
      case "week": return { start: startOfWeek(now), end: endOfWeek(now) };
      case "month": return { start: startOfMonth(now), end: endOfMonth(now) };
      case "all": return { start: null, end: null };
    }
  };

  const getPreviousDateRange = (period: TimePeriod) => {
    const now = new Date();
    switch (period) {
      case "today": return { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)) };
      case "week": return { start: startOfWeek(subWeeks(now, 1)), end: endOfWeek(subWeeks(now, 1)) };
      case "month": return { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) };
      case "all": return { start: null, end: null };
    }
  };

  const loadMetrics = useCallback(async () => {
    try {
      setLoading(true);
      const { start, end } = getDateRange(timePeriod);
      const { start: prevStart, end: prevEnd } = getPreviousDateRange(timePeriod);

      let givingsQuery = supabase.from("givings").select("amount, payment_method, created_at, giving_type_id, giving_types(name)").eq("status", "verified");
      if (start && end) { givingsQuery = givingsQuery.gte("created_at", start.toISOString()).lte("created_at", end.toISOString()); }
      let prevGivingsQuery = supabase.from("givings").select("amount").eq("status", "verified");
      if (prevStart && prevEnd) { prevGivingsQuery = prevGivingsQuery.gte("created_at", prevStart.toISOString()).lte("created_at", prevEnd.toISOString()); }

      let fundedExpensesQuery = supabase
        .from("expense_requests")
        .select("amount")
        .in("status", ["approved", "partially_paid", "paid"]);
      if (start && end) {
        fundedExpensesQuery = fundedExpensesQuery.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
      }

      let servicesInPeriodQuery = supabase
        .from("services")
        .select("id", { count: "exact", head: true })
        .or("is_archived.is.null,is_archived.eq.false");
      if (start && end) {
        servicesInPeriodQuery = servicesInPeriodQuery.gte("service_date", format(start, "yyyy-MM-dd")).lte("service_date", format(end, "yyyy-MM-dd"));
      }

      let mobilizationQuery = supabase.from("member_invitations").select("status, created_at");
      if (start && end) {
        mobilizationQuery = mobilizationQuery.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
      }

      const [givingsRes, prevGivingsRes, activeMembersRes, newMembersRes, pendingGivingsRes, pendingExpensesRes, pendingServicesRes, attendanceCountRes, attendanceRes, testimoniesCountRes, prayersCountRes, recentGivingsRes, recentTestimoniesRes, recentPrayersRes, fundedExpensesRes, servicesUpcomingRes, servicesInPeriodRes, mobilizationRes] = await Promise.all([
        givingsQuery, prevGivingsQuery,
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
        start ? supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true).gte("created_at", start.toISOString()) : Promise.resolve({ count: 0, error: null }),
        supabase.from("givings").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("expense_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("services").select("id", { count: "exact", head: true }).eq("approval_status", "pending_admin_approval"),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("status", "present"),
        supabase.from("attendance").select("services(service_type)").eq("status", "present"),
        supabase.from("testimonies").select("id", { count: "exact", head: true }),
        supabase.from("prayer_requests").select("id", { count: "exact", head: true }),
        supabase.from("givings").select("amount, created_at").eq("status", "verified").order("created_at", { ascending: false }).limit(5),
        supabase.from("testimonies").select("created_at").order("created_at", { ascending: false }).limit(3),
        supabase.from("prayer_requests").select("created_at").order("created_at", { ascending: false }).limit(2),
        fundedExpensesQuery,
        supabase.from("services").select("id", { count: "exact", head: true }).gte("service_date", format(new Date(), "yyyy-MM-dd")).or("is_archived.is.null,is_archived.eq.false"),
        servicesInPeriodQuery,
        mobilizationQuery,
      ]);

      const totalGivings = givingsRes.data?.reduce((sum, g) => sum + Number(g.amount), 0) || 0;
      const previousGivings = prevGivingsRes.data?.reduce((sum, g) => sum + Number(g.amount), 0) || 0;
      const activeMembers = activeMembersRes.count || 0;
      const newMembers = newMembersRes.count || 0;

      const givingsByType: { [key: string]: number } = {};
      givingsRes.data?.forEach(g => { const typeName = (g.giving_types as any)?.name || "Other"; givingsByType[typeName] = (givingsByType[typeName] || 0) + Number(g.amount); });
      const restrictedKeywords = ["tithe", "first fruit", "firstfruit", "seed", "pledge"];
      let restrictedGivings = 0;
      let eligibleActivityGivings = 0;

      givingsRes.data?.forEach((g) => {
        const typeName = ((g.giving_types as any)?.name || "").toLowerCase().trim();
        const amount = Number(g.amount) || 0;
        const isRestricted = restrictedKeywords.some((keyword) => typeName.includes(keyword));
        if (isRestricted) {
          restrictedGivings += amount;
        } else {
          eligibleActivityGivings += amount;
        }
      });

      const fundedExpenses = fundedExpensesRes.data?.reduce((sum, expense) => sum + Number(expense.amount), 0) || 0;
      const activitySupportFunds = eligibleActivityGivings - fundedExpenses;

      const givingsTrendMap: { [key: string]: { cash: number; mobile: number; bank: number; card: number } } = {};
      givingsRes.data?.forEach(g => {
        const dateKey = format(new Date(g.created_at), "MMM dd");
        if (!givingsTrendMap[dateKey]) givingsTrendMap[dateKey] = { cash: 0, mobile: 0, bank: 0, card: 0 };
        const method = g.payment_method.toLowerCase();
        if (method.includes("cash")) givingsTrendMap[dateKey].cash += Number(g.amount);
        else if (method.includes("mobile")) givingsTrendMap[dateKey].mobile += Number(g.amount);
        else if (method.includes("bank")) givingsTrendMap[dateKey].bank += Number(g.amount);
        else if (method.includes("card")) givingsTrendMap[dateKey].card += Number(g.amount);
      });

      const attendanceByType: { [key: string]: number } = {};
      attendanceRes.data?.forEach(a => { const typeName = (a.services as any)?.service_type || "other"; attendanceByType[typeName] = (attendanceByType[typeName] || 0) + 1; });

      const recentActivity: { type: string; message: string; time: string }[] = [];
      (recentGivingsRes.data || []).forEach(g => { recentActivity.push({ type: "giving", message: `New giving recorded (${formatAmount(Number(g.amount))})`, time: formatTimeAgo(new Date(g.created_at)) }); });
      (recentTestimoniesRes.data || []).forEach(t => { recentActivity.push({ type: "testimony", message: "New testimony shared", time: formatTimeAgo(new Date(t.created_at)) }); });
      (recentPrayersRes.data || []).forEach(p => { recentActivity.push({ type: "prayer", message: "New prayer request submitted", time: formatTimeAgo(new Date(p.created_at)) }); });
      recentActivity.sort((a, b) => parseTimeAgo(a.time) - parseTimeAgo(b.time));
      const mobilizationInvites = mobilizationRes.data?.length || 0;
      const mobilizationConfirmed = mobilizationRes.data?.filter((invite) => ["confirmed", "attended"].includes((invite.status || "").toLowerCase())).length || 0;
      const mobilizationAttended = mobilizationRes.data?.filter((invite) => (invite.status || "").toLowerCase() === "attended").length || 0;

      setMetrics({
        totalGivings, previousGivings, activeMembers, newMembers,
        pendingGivings: pendingGivingsRes.count || 0, pendingExpenses: pendingExpensesRes.count || 0, pendingServices: pendingServicesRes.count || 0,
        totalAttendance: attendanceCountRes.count || 0,
        avgAttendance: (attendanceCountRes.count || 0) ? Math.round((attendanceCountRes.count || 0) / Math.max(Object.keys(givingsTrendMap).length, 1)) : 0,
        testimonies: testimoniesCountRes.count || 0, prayers: prayersCountRes.count || 0,
        givingsByType: Object.entries(givingsByType).map(([name, value]) => ({ name, value })),
        givingsTrend: Object.entries(givingsTrendMap).map(([date, values]) => ({ date, ...values })),
        attendanceByType: Object.entries(attendanceByType).map(([name, count]) => ({ name: formatServiceType(name), count })),
        recentActivity: recentActivity.slice(0, 10),
        eligibleActivityGivings,
        restrictedGivings,
        fundedExpenses,
        activitySupportFunds,
        eventsUpcoming: servicesUpcomingRes.count || 0,
        eventsInPeriod: servicesInPeriodRes.count || 0,
        mobilizationInvites,
        mobilizationConfirmed,
        mobilizationAttended,
      });
    } catch (error) { console.error("Error loading metrics:", error); toast.error("Failed to load dashboard metrics"); } finally { setLoading(false); }
  }, [timePeriod]);

  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return { percent: "0", direction: "neutral" as const };
    const percent = ((current - previous) / previous) * 100;
    return { percent: Math.abs(percent).toFixed(1), direction: percent > 0 ? "up" as const : percent < 0 ? "down" as const : "neutral" as const };
  };

  const formatServiceType = (type: string): string => type.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

  useEffect(() => {
    checkUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) navigate("/admin/auth");
    });
    return () => subscription.unsubscribe();
  }, [checkUser, navigate]);

  useEffect(() => { if (user) loadMetrics(); }, [loadMetrics, user]);

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const parseTimeAgo = (timeStr: string): number => {
    const match = timeStr.match(/(\d+)\s+(min|hour|day)/);
    if (!match) return 0;
    const value = parseInt(match[1]);
    const unit = match[2];
    if (unit === "min") return value;
    if (unit === "hour") return value * 60;
    return value * 1440;
  };

  const handleExport = async () => {
    if (!exportStartDate || !exportEndDate) { toast.error("Please select both start and end dates"); return; }
    setExporting(true);
    try {
      const { data: givingsData } = await supabase.from("givings").select("*, profiles(full_name), giving_types(name)").gte("created_at", exportStartDate).lte("created_at", exportEndDate);
      const formattedData = givingsData?.map(g => ({ Date: format(new Date(g.created_at), "yyyy-MM-dd"), Member: (g.profiles as any)?.full_name || "Anonymous", Type: (g.giving_types as any)?.name || "Other", Amount: g.amount, Currency: g.currency, Method: g.payment_method, Status: g.status })) || [];
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.json_to_sheet(formattedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Givings");
      XLSX.writeFile(wb, `givings-report-${exportStartDate}-to-${exportEndDate}.xlsx`);
      toast.success("Data exported successfully");
      setExportDialogOpen(false);
    } catch (error) { console.error("Export error:", error); toast.error("Failed to export data"); } finally { setExporting(false); }
  };

  if (loading || !metrics) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    );
  }

  const trend = calculateTrend(metrics.totalGivings, metrics.previousGivings);
  const totalPending = metrics.pendingGivings + metrics.pendingExpenses + metrics.pendingServices;
  const activityFundingUtilization = metrics.eligibleActivityGivings > 0 ? (metrics.fundedExpenses / metrics.eligibleActivityGivings) * 100 : 0;

  const statCards = [
    { label: "Total Givings", value: formatAmount(metrics.totalGivings), sub: "vs previous period", icon: DollarSign, color: "hsl(var(--sage))", trend, link: "/admin/reports/financial", linkLabel: "View reports ›" },
    { label: "Active Members", value: metrics.activeMembers.toString(), sub: `${metrics.newMembers} new this period`, icon: Users, color: "hsl(var(--gold))", link: "/admin/users", linkLabel: "Manage members ›" },
    { label: "Pending Approvals", value: totalPending.toString(), sub: `${metrics.pendingGivings} givings, ${metrics.pendingExpenses} expenses`, icon: AlertCircle, color: "hsl(var(--terracotta))", link: "/admin/expenses/pending", linkLabel: "Review now ›" },
    { label: "Total Attendance", value: metrics.totalAttendance.toString(), sub: `Avg: ${metrics.avgAttendance}/service`, icon: Calendar, color: "hsl(var(--navy-light))", link: "/admin/reports/attendance", linkLabel: "View trends ›" },
    { label: "Engagement", value: (metrics.testimonies + metrics.prayers).toString(), sub: `${metrics.testimonies} testimonies, ${metrics.prayers} prayers`, icon: MessageSquare, color: "hsl(var(--gold-dark))", link: "/admin/reports/financial", linkLabel: "View details ›" },
  ];

  const periodButtons: { label: string; value: TimePeriod }[] = [
    { label: "Today", value: "today" },
    { label: "This Week", value: "week" },
    { label: "This Month", value: "month" },
    { label: "All Time", value: "all" },
  ];

  const activitySnapshotCards = [
    {
      title: "Events",
      value: metrics.eventsInPeriod.toString(),
      subtitle: `${metrics.eventsUpcoming} upcoming events`,
      helper: "Review event plans and schedules",
      icon: CalendarCheck2,
      action: () => navigate("/admin/events"),
    },
    {
      title: "Attendance",
      value: metrics.totalAttendance.toString(),
      subtitle: `${metrics.avgAttendance} avg attendance per service`,
      helper: "Open attendance trends and service breakdown",
      icon: Users,
      action: () => navigate("/admin/reports/attendance"),
    },
    {
      title: "Mobilization",
      value: metrics.mobilizationInvites.toString(),
      subtitle: `${metrics.mobilizationConfirmed} confirmations • ${metrics.mobilizationAttended} attended`,
      helper: "Track invitations and conversion to attendance",
      icon: Megaphone,
      action: () => navigate("/admin/mobilization"),
    },
  ];

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
      >
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            Welcome back, {profile?.full_name || "Admin"}
          </h1>
          <p className="text-muted-foreground mt-1">Here's what's happening across your platform.</p>
        </div>
        <div className="flex gap-1.5 bg-muted/60 p-1 rounded-lg">
          {periodButtons.map(p => (
            <Button
              key={p.value}
              variant="ghost"
              size="sm"
              onClick={() => setTimePeriod(p.value)}
              className={`text-xs px-3 rounded-md transition-all ${
                timePeriod === p.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "hover:bg-background/60 text-muted-foreground"
              }`}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div key={card.label} custom={i} variants={fadeUp} initial="hidden" animate="visible">
              <Card className="relative overflow-hidden border-none card-elevated bg-card cursor-pointer group" onClick={() => navigate(card.link)}>
                <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl" style={{ backgroundColor: card.color }} />
                <CardHeader className="pb-2 pl-5">
                  <div className="flex items-center justify-between">
                    <div className="h-10 w-10 rounded-xl icon-container-glass flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${card.color}20, ${card.color}08)` }}>
                      <Icon className="h-5 w-5" style={{ color: card.color }} />
                    </div>
                    {card.trend && card.trend.direction !== "neutral" && (
                      <span className={`flex items-center gap-0.5 text-xs font-semibold ${card.trend.direction === "up" ? "text-sage" : "text-destructive"}`}>
                        {card.trend.direction === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {card.trend.percent}%
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pl-5 pb-4">
                  <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                  <p className="text-2xl font-mono font-bold text-foreground tracking-tight mt-0.5">{card.value}</p>
                  <p className="text-[0.65rem] text-muted-foreground mt-1">{card.sub}</p>
                  <p className="text-xs font-medium mt-2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: card.color }}>{card.linkLabel}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible">
        <Card className="border-none shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-lg">
              <Wallet className="h-5 w-5 text-accent" />
              Activity Support Funds Snapshot
            </CardTitle>
            <CardDescription>Funds available for Manifest activities are based on verified givings excluding first fruits, tithes, seed, and pledges.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="rounded-xl border bg-sage/5 p-4">
              <p className="text-xs text-muted-foreground">Eligible Givings</p>
              <p className="text-xl font-mono font-bold mt-1 text-foreground">{formatAmount(metrics.eligibleActivityGivings)}</p>
            </div>
            <div className="rounded-xl border bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground">Restricted Givings (Excluded)</p>
              <p className="text-xl font-mono font-bold mt-1 text-muted-foreground">{formatAmount(metrics.restrictedGivings)}</p>
            </div>
            <div className="rounded-xl border bg-accent/5 p-4">
              <p className="text-xs text-muted-foreground">Funded Expenses</p>
              <p className="text-xl font-mono font-bold mt-1 text-foreground">{formatAmount(metrics.fundedExpenses)}</p>
            </div>
            <div className="rounded-xl border bg-primary/5 p-4 ring-1 ring-primary/10">
              <p className="text-xs text-muted-foreground">Funds Available for Activities</p>
              <p className={`text-xl font-mono font-bold mt-1 ${metrics.activitySupportFunds < 0 ? "text-destructive" : "text-primary"}`}>
                {formatAmount(metrics.activitySupportFunds)}
              </p>
              <p className="text-[0.65rem] text-muted-foreground mt-1">
                {activityFundingUtilization.toFixed(1)}% of eligible givings allocated
              </p>
            </div>
            <div className="md:col-span-4">
              <Button variant="outline" className="w-full md:w-auto" onClick={() => navigate("/admin/reports/financial")}>
                <HandCoins className="h-4 w-4 mr-2" />
                Open financial reports
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {activitySnapshotCards.map((snapshot, i) => {
          const Icon = snapshot.icon;
          return (
            <motion.button
              key={snapshot.title}
              type="button"
              custom={i + 6}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              onClick={snapshot.action}
              className="text-left"
            >
              <Card className="border-none shadow-md hover:shadow-lg transition-all h-full group">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <CardTitle className="font-display text-lg">{snapshot.title}</CardTitle>
                  <CardDescription>{snapshot.helper}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-mono font-bold">{snapshot.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{snapshot.subtitle}</p>
                </CardContent>
              </Card>
            </motion.button>
          );
        })}
      </div>

      {metrics.givingsTrend.length > 0 && (
        <motion.div custom={10} variants={fadeUp} initial="hidden" animate="visible">
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <TrendingUp className="h-5 w-5 text-accent" />
                Giving Trends
              </CardTitle>
              <CardDescription>Contributions over time by payment method</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metrics.givingsTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" angle={-45} textAnchor="end" height={70} tick={{ fontSize: 12 }} />
                  <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v.toString()} width={70} tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" }} />
                  <Legend />
                  <Line type="monotone" dataKey="cash" stroke="hsl(var(--sage))" strokeWidth={2} name="Cash" />
                  <Line type="monotone" dataKey="mobile" stroke="hsl(var(--gold))" strokeWidth={2} name="Mobile Money" />
                  <Line type="monotone" dataKey="bank" stroke="hsl(var(--navy-light))" strokeWidth={2} name="Bank Transfer" />
                  <Line type="monotone" dataKey="card" stroke="hsl(var(--terracotta))" strokeWidth={2} name="Card" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {metrics.givingsByType.length > 0 && (
          <motion.div custom={6} variants={fadeUp} initial="hidden" animate="visible">
            <Card className="border-none shadow-md h-full">
              <CardHeader>
                <CardTitle className="font-display text-lg">Contributions by Type</CardTitle>
                <CardDescription>Breakdown of giving categories</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={metrics.givingsByType}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 11 }} interval={0} />
                    <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v.toString()} width={70} tick={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" }} />
                    <Bar dataKey="value" fill="hsl(var(--gold))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {metrics.attendanceByType.length > 0 && (
          <motion.div custom={7} variants={fadeUp} initial="hidden" animate="visible">
            <Card className="border-none shadow-md h-full">
              <CardHeader>
                <CardTitle className="font-display text-lg">Attendance Overview</CardTitle>
                <CardDescription>Service participation trends</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={metrics.attendanceByType}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" }} />
                    <Bar dataKey="count" fill="hsl(var(--sage))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <motion.div custom={8} variants={fadeUp} initial="hidden" animate="visible" className="md:col-span-2">
          <Card className="border-none shadow-md h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <MessageSquare className="h-5 w-5 text-accent" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest updates across the platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics.recentActivity.length > 0 ? metrics.recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-start gap-3 pb-3 border-b border-border/50 last:border-0">
                    <div className="h-2 w-2 rounded-full bg-accent mt-2 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{activity.message}</p>
                      <p className="text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div custom={9} variants={fadeUp} initial="hidden" animate="visible" className="space-y-6">
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle className="font-display text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-primary hover:bg-primary/90">
                    <Download className="mr-2 h-4 w-4" />
                    Export Data
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Export Data</DialogTitle>
                    <DialogDescription>Select a date range to export giving data to Excel</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="start-date">Start Date</Label>
                      <Input id="start-date" type="date" value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end-date">End Date</Label>
                      <Input id="end-date" type="date" value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setExportDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleExport} disabled={exporting}>{exporting ? "Exporting..." : "Export"}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {totalPending > 0 && (
            <Card className="border-none shadow-md border-l-4 border-l-terracotta">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Requires Attention
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {metrics.pendingGivings > 0 && (
                  <Button variant="ghost" size="sm" className="w-full justify-between text-xs" onClick={() => navigate("/admin/givings")}>
                    Pending Givings ({metrics.pendingGivings}) <ChevronRight className="h-3 w-3" />
                  </Button>
                )}
                {metrics.pendingExpenses > 0 && (
                  <Button variant="ghost" size="sm" className="w-full justify-between text-xs" onClick={() => navigate("/admin/expenses/pending")}>
                    Pending Expenses ({metrics.pendingExpenses}) <ChevronRight className="h-3 w-3" />
                  </Button>
                )}
                {metrics.pendingServices > 0 && (
                  <Button variant="ghost" size="sm" className="w-full justify-between text-xs" onClick={() => navigate("/admin/pending-services")}>
                    Pending Services ({metrics.pendingServices}) <ChevronRight className="h-3 w-3" />
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AdminDashboard;
