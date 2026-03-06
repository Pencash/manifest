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
import { Download, DollarSign, Users, AlertCircle, TrendingUp, TrendingDown, Calendar, MessageSquare, ChevronRight } from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths } from "date-fns";
import { hasAdminAccess } from "@/lib/roles";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAmount } from "@/lib/utils";

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
}

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

      if (!session?.user) {
        navigate("/admin/auth");
        return;
      }

      setUser(session.user);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      if (rolesError) throw rolesError;

      const mainRole = rolesData && rolesData.length > 0 ? rolesData[0].role : null;

      if (!hasAdminAccess(mainRole)) {
        toast.error("Access denied. Admin privileges required.");
        navigate("/dashboard");
        return;
      }
    } catch (error: any) {
      console.error("Error loading admin profile or role:", error);
      toast.error("Failed to load admin profile");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const getDateRange = (period: TimePeriod) => {
    const now = new Date();
    switch (period) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "week":
        return { start: startOfWeek(now), end: endOfWeek(now) };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "all":
        return { start: null, end: null };
    }
  };

  const getPreviousDateRange = (period: TimePeriod) => {
    const now = new Date();
    switch (period) {
      case "today":
        return { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)) };
      case "week":
        return { start: startOfWeek(subWeeks(now, 1)), end: endOfWeek(subWeeks(now, 1)) };
      case "month":
        return { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) };
      case "all":
        return { start: null, end: null };
    }
  };

  const loadMetrics = useCallback(async () => {
    try {
      setLoading(true);
      const { start, end } = getDateRange(timePeriod);
      const { start: prevStart, end: prevEnd } = getPreviousDateRange(timePeriod);

      let givingsQuery = supabase.from("givings").select("amount, payment_method, created_at, giving_type_id, giving_types(name)").eq("status", "verified");
      if (start && end) {
        givingsQuery = givingsQuery.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
      }

      let prevGivingsQuery = supabase.from("givings").select("amount").eq("status", "verified");
      if (prevStart && prevEnd) {
        prevGivingsQuery = prevGivingsQuery.gte("created_at", prevStart.toISOString()).lte("created_at", prevEnd.toISOString());
      }

      const [
        givingsRes,
        prevGivingsRes,
        activeMembersRes,
        newMembersRes,
        pendingGivingsRes,
        pendingExpensesRes,
        pendingServicesRes,
        attendanceCountRes,
        attendanceRes,
        testimoniesCountRes,
        prayersCountRes,
        recentGivingsRes,
        recentTestimoniesRes,
        recentPrayersRes,
      ] = await Promise.all([
        givingsQuery,
        prevGivingsQuery,
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true),
        start
          ? supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_active", true).gte("created_at", start.toISOString())
          : Promise.resolve({ count: 0, error: null }),
        supabase.from("givings").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("expense_requests").select("id", { count: "exact", head: true }).in("status", ["pending_approval", "draft"]),
        supabase.from("services").select("id", { count: "exact", head: true }).eq("approval_status", "pending_admin_approval"),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("status", "present"),
        supabase.from("attendance").select("services(service_type)").eq("status", "present"),
        supabase.from("testimonies").select("id", { count: "exact", head: true }),
        supabase.from("prayer_requests").select("id", { count: "exact", head: true }),
        supabase.from("givings").select("amount, created_at").eq("status", "verified").order("created_at", { ascending: false }).limit(5),
        supabase.from("testimonies").select("created_at").order("created_at", { ascending: false }).limit(3),
        supabase.from("prayer_requests").select("created_at").order("created_at", { ascending: false }).limit(2),
      ]);

      const totalGivings = givingsRes.data?.reduce((sum, g) => sum + Number(g.amount), 0) || 0;
      const previousGivings = prevGivingsRes.data?.reduce((sum, g) => sum + Number(g.amount), 0) || 0;

      const activeMembers = activeMembersRes.count || 0;
      const newMembers = newMembersRes.count || 0;

      const givingsByType: { [key: string]: number } = {};
      givingsRes.data?.forEach(g => {
        const typeName = (g.giving_types as any)?.name || "Other";
        givingsByType[typeName] = (givingsByType[typeName] || 0) + Number(g.amount);
      });

      const givingsTrendMap: { [key: string]: { cash: number; mobile: number; bank: number; card: number } } = {};
      givingsRes.data?.forEach(g => {
        const dateKey = format(new Date(g.created_at), "MMM dd");
        if (!givingsTrendMap[dateKey]) {
          givingsTrendMap[dateKey] = { cash: 0, mobile: 0, bank: 0, card: 0 };
        }
        const method = g.payment_method.toLowerCase();
        if (method.includes("cash")) givingsTrendMap[dateKey].cash += Number(g.amount);
        else if (method.includes("mobile")) givingsTrendMap[dateKey].mobile += Number(g.amount);
        else if (method.includes("bank")) givingsTrendMap[dateKey].bank += Number(g.amount);
        else if (method.includes("card")) givingsTrendMap[dateKey].card += Number(g.amount);
      });

      const attendanceByType: { [key: string]: number } = {};
      attendanceRes.data?.forEach(a => {
        const typeName = (a.services as any)?.service_type || "other";
        attendanceByType[typeName] = (attendanceByType[typeName] || 0) + 1;
      });

      const recentActivity: { type: string; message: string; time: string }[] = [];
      
      const recentGivings = recentGivingsRes.data || [];
      recentGivings.forEach(g => {
        recentActivity.push({
          type: "giving",
          message: `New giving recorded (${formatAmount(Number(g.amount))})`,
          time: formatTimeAgo(new Date(g.created_at))
        });
      });

      const recentTestimonies = recentTestimoniesRes.data || [];
      recentTestimonies.forEach(t => {
        recentActivity.push({
          type: "testimony",
          message: "New testimony shared",
          time: formatTimeAgo(new Date(t.created_at))
        });
      });

      const recentPrayers = recentPrayersRes.data || [];
      recentPrayers.forEach(p => {
        recentActivity.push({
          type: "prayer",
          message: "New prayer request submitted",
          time: formatTimeAgo(new Date(p.created_at))
        });
      });

      recentActivity.sort((a, b) => {
        const timeA = parseTimeAgo(a.time);
        const timeB = parseTimeAgo(b.time);
        return timeA - timeB;
      });

      setMetrics({
        totalGivings,
        previousGivings,
        activeMembers,
        newMembers,
        pendingGivings: pendingGivingsRes.count || 0,
        pendingExpenses: pendingExpensesRes.count || 0,
        pendingServices: pendingServicesRes.count || 0,
        totalAttendance: attendanceCountRes.count || 0,
        avgAttendance: (attendanceCountRes.count || 0) ? Math.round((attendanceCountRes.count || 0) / Math.max(Object.keys(givingsTrendMap).length, 1)) : 0,
        testimonies: testimoniesCountRes.count || 0,
        prayers: prayersCountRes.count || 0,
        givingsByType: Object.entries(givingsByType).map(([name, value]) => ({ name, value })),
        givingsTrend: Object.entries(givingsTrendMap).map(([date, values]) => ({ date, ...values })),
        attendanceByType: Object.entries(attendanceByType).map(([name, count]) => ({ name: formatServiceType(name), count })),
        recentActivity: recentActivity.slice(0, 10)
      });
    } catch (error) {
      console.error("Error loading metrics:", error);
      toast.error("Failed to load dashboard metrics");
    } finally {
      setLoading(false);
    }
  }, [timePeriod]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return { percent: "0", direction: "neutral" as const };
    const percent = ((current - previous) / previous) * 100;
    return {
      percent: Math.abs(percent).toFixed(1),
      direction: percent > 0 ? "up" as const : percent < 0 ? "down" as const : "neutral" as const
    };
  };

  const formatServiceType = (type: string): string => {
    return type.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  };

  useEffect(() => {
    checkUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/admin/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [checkUser, navigate]);

  useEffect(() => {
    if (user) {
      loadMetrics();
    }
  }, [loadMetrics, user]);

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
    if (!exportStartDate || !exportEndDate) {
      toast.error("Please select both start and end dates");
      return;
    }

    setExporting(true);
    try {
      const { data: givingsData } = await supabase
        .from("givings")
        .select("*, profiles(full_name), giving_types(name)")
        .gte("created_at", exportStartDate)
        .lte("created_at", exportEndDate);

      const formattedData = givingsData?.map(g => ({
        Date: format(new Date(g.created_at), "yyyy-MM-dd"),
        Member: (g.profiles as any)?.full_name || "Anonymous",
        Type: (g.giving_types as any)?.name || "Other",
        Amount: g.amount,
        Currency: g.currency,
        Method: g.payment_method,
        Status: g.status
      })) || [];

      const XLSX = await import("xlsx");
      const ws = XLSX.utils.json_to_sheet(formattedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Givings");
      XLSX.writeFile(wb, `givings-report-${exportStartDate}-to-${exportEndDate}.xlsx`);

      toast.success("Data exported successfully");
      setExportDialogOpen(false);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    } finally {
      setExporting(false);
    }
  };

  if (loading || !metrics) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const trend = calculateTrend(metrics.totalGivings, metrics.previousGivings);
  const totalPending = metrics.pendingGivings + metrics.pendingExpenses + metrics.pendingServices;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Welcome back, {profile?.full_name || "Admin"}!</h1>
          <p className="text-muted-foreground">Dashboard Overview</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={timePeriod === "today" ? "default" : "outline"} 
            size="sm"
            onClick={() => setTimePeriod("today")}
          >
            Today
          </Button>
          <Button 
            variant={timePeriod === "week" ? "default" : "outline"} 
            size="sm"
            onClick={() => setTimePeriod("week")}
          >
            This Week
          </Button>
          <Button 
            variant={timePeriod === "month" ? "default" : "outline"} 
            size="sm"
            onClick={() => setTimePeriod("month")}
          >
            This Month
          </Button>
          <Button 
            variant={timePeriod === "all" ? "default" : "outline"} 
            size="sm"
            onClick={() => setTimePeriod("all")}
          >
            All Time
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="border-l-4 border-l-[hsl(142,76%,36%)]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-full bg-[hsl(142,76%,36%)]/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-[hsl(142,76%,36%)]" />
              </div>
              {trend.direction !== "neutral" && (
                <div className={`flex items-center gap-1 text-sm ${trend.direction === "up" ? "text-[hsl(142,76%,36%)]" : "text-destructive"}`}>
                  {trend.direction === "up" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  <span>{trend.percent}%</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground/70">Total Givings</p>
              <p className="text-2xl font-bold text-foreground">{formatAmount(metrics.totalGivings)}</p>
              <p className="text-xs text-foreground/60">vs previous period</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[hsl(221,83%,53%)]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-full bg-[hsl(221,83%,53%)]/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-[hsl(221,83%,53%)]" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground/70">Active Members</p>
              <p className="text-2xl font-bold text-foreground">{metrics.activeMembers}</p>
              <p className="text-xs text-foreground/60">{metrics.newMembers} new this period</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[hsl(38,92%,50%)]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-full bg-[hsl(38,92%,50%)]/10 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-[hsl(38,92%,50%)]" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground/70">Pending Approvals</p>
              <p className="text-2xl font-bold text-foreground">{totalPending}</p>
              <p className="text-xs text-foreground/60">
                {metrics.pendingGivings} givings, {metrics.pendingExpenses} expenses
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[hsl(271,81%,56%)]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-full bg-[hsl(271,81%,56%)]/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-[hsl(271,81%,56%)]" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground/70">Total Attendance</p>
              <p className="text-2xl font-bold text-foreground">{metrics.totalAttendance}</p>
              <p className="text-xs text-foreground/60">Avg: {metrics.avgAttendance}/service</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[hsl(189,94%,43%)]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="h-10 w-10 rounded-full bg-[hsl(189,94%,43%)]/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-[hsl(189,94%,43%)]" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground/70">Engagement</p>
              <p className="text-2xl font-bold text-foreground">{metrics.testimonies + metrics.prayers}</p>
              <p className="text-xs text-foreground/60">
                {metrics.testimonies} testimonies, {metrics.prayers} prayers
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {metrics.givingsTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Giving Trends
            </CardTitle>
            <CardDescription>Total contributions over time by payment method</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={metrics.givingsTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  angle={-45}
                  textAnchor="end"
                  height={70}
                  tick={{ fontSize: 12 }}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(value) => {
                    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                    return value.toString();
                  }}
                  width={70}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "var(--radius)"
                  }} 
                />
                <Legend />
                <Line type="monotone" dataKey="cash" stroke="hsl(142, 76%, 36%)" strokeWidth={2} name="Cash" />
                <Line type="monotone" dataKey="mobile" stroke="hsl(221, 83%, 53%)" strokeWidth={2} name="Mobile Money" />
                <Line type="monotone" dataKey="bank" stroke="hsl(38, 92%, 50%)" strokeWidth={2} name="Bank Transfer" />
                <Line type="monotone" dataKey="card" stroke="hsl(271, 81%, 56%)" strokeWidth={2} name="Card" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {metrics.givingsByType.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Contributions by Type</CardTitle>
              <CardDescription>Breakdown of giving categories</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={metrics.givingsByType}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(var(--muted-foreground))"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    tick={{ fontSize: 11 }}
                    interval={0}
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(value) => {
                      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                      if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                      return value.toString();
                    }}
                    width={70}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)"
                    }} 
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {metrics.attendanceByType.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Attendance Overview</CardTitle>
              <CardDescription>Service participation trends</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={metrics.attendanceByType}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)"
                    }} 
                  />
                  <Bar dataKey="count" fill="hsl(var(--secondary))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>Latest updates across the platform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics.recentActivity.length > 0 ? (
              metrics.recentActivity.map((activity, index) => (
                <div key={index} className="flex items-start gap-3 pb-3 border-b border-border last:border-0">
                  <div className="h-2 w-2 rounded-full bg-primary mt-2" />
                  <div className="flex-1">
                    <p className="text-sm text-foreground">{activity.message}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
            <DialogTrigger asChild>
              <Button>
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
                  <Input
                    id="start-date"
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setExportDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleExport} disabled={exporting}>
                  {exporting ? "Exporting..." : "Export"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {totalPending > 0 && timePeriod === "all" && (
        <Card className="border-[hsl(38,92%,50%)]/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[hsl(38,92%,50%)]">
              <AlertCircle className="h-5 w-5" />
              Items Requiring Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.pendingGivings > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Pending Givings ({metrics.pendingGivings})</span>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/admin/givings")}>
                    View <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              )}
              {metrics.pendingExpenses > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Pending Expenses ({metrics.pendingExpenses})</span>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/admin/expense-requests")}>
                    View <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              )}
              {metrics.pendingServices > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Pending Services ({metrics.pendingServices})</span>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/admin/pending-services")}>
                    View <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminDashboard;
