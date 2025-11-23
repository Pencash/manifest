import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, Users, Sparkles, Clock, Target, Download } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { formatAmount } from "@/lib/utils";
import { hasAdminAccess } from "@/lib/roles";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConversionMetrics {
  total_visitors: number;
  total_born_again: number;
  conversion_rate: number;
  monthly_visitors: number;
  monthly_born_again: number;
  active_followups: number;
}

interface RecentConvert {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  first_visit_date: string | null;
}

interface MonthlyTrend {
  month: string;
  visitors: number;
  born_again: number;
  conversion_rate: number;
}

const ConversionDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<ConversionMetrics | null>(null);
  const [recentConverts, setRecentConverts] = useState<RecentConvert[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [dateRange, setDateRange] = useState<{ start: Date | undefined; end: Date | undefined }>({
    start: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1),
    end: new Date(),
  });
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [services, setServices] = useState<any[]>([]);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadData();
    }
  }, [dateRange, serviceFilter]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/admin/auth");
      return;
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    const userRole = roles?.[0]?.role;
    if (!hasAdminAccess(userRole)) {
      toast.error("Access denied. Admin privileges required.");
      navigate("/dashboard");
      return;
    }

    setLoading(false);
    loadData();
    loadServices();
  };

  const loadServices = async () => {
    const { data, error } = await supabase
      .from("services")
      .select("id, name, service_date")
      .eq("is_published", true)
      .order("service_date", { ascending: false });

    if (!error && data) {
      setServices(data);
    }
  };

  const loadData = async () => {
    try {
      // Get all-time metrics
      const { data: allVisitors } = await supabase
        .from("contacts")
        .select("id")
        .eq("contact_type", "visitor");

      const { data: allBornAgain } = await supabase
        .from("contacts")
        .select("id")
        .eq("contact_type", "born_again");

      // Get monthly metrics (this month)
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const { data: monthlyVisitors } = await supabase
        .from("contacts")
        .select("id")
        .eq("contact_type", "visitor")
        .gte("created_at", monthStart);

      const { data: monthlyBornAgain } = await supabase
        .from("contacts")
        .select("id")
        .eq("contact_type", "born_again")
        .gte("created_at", monthStart);

      // Get active follow-ups
      const { data: followups } = await supabase
        .from("visitor_followups")
        .select("id")
        .eq("status", "pending");

      const totalVisitors = allVisitors?.length || 0;
      const totalBornAgain = allBornAgain?.length || 0;

      const metricsData: ConversionMetrics = {
        total_visitors: totalVisitors,
        total_born_again: totalBornAgain,
        conversion_rate: totalVisitors > 0 ? (totalBornAgain / totalVisitors) * 100 : 0,
        monthly_visitors: monthlyVisitors?.length || 0,
        monthly_born_again: monthlyBornAgain?.length || 0,
        active_followups: followups?.length || 0,
      };

      setMetrics(metricsData);

      // Load recent converts
      const { data: converts } = await supabase
        .from("contacts")
        .select("id, full_name, email, phone, created_at, first_visit_date")
        .eq("contact_type", "born_again")
        .order("created_at", { ascending: false })
        .limit(20);

      setRecentConverts(converts || []);

      // Load monthly trend data
      await loadMonthlyTrend();
    } catch (error: any) {
      console.error("Error loading conversion data:", error);
      toast.error("Failed to load conversion data");
    }
  };

  const loadMonthlyTrend = async () => {
    if (!dateRange.start || !dateRange.end) return;

    try {
      const { data: allContacts } = await supabase
        .from("contacts")
        .select("contact_type, created_at")
        .in("contact_type", ["visitor", "born_again"])
        .gte("created_at", dateRange.start.toISOString())
        .lte("created_at", dateRange.end.toISOString());

      // Group by month
      const monthlyData: { [key: string]: { visitors: number; born_again: number } } = {};

      allContacts?.forEach((contact) => {
        const month = format(new Date(contact.created_at), "MMM yyyy");
        if (!monthlyData[month]) {
          monthlyData[month] = { visitors: 0, born_again: 0 };
        }
        if (contact.contact_type === "visitor") {
          monthlyData[month].visitors++;
        } else if (contact.contact_type === "born_again") {
          monthlyData[month].born_again++;
        }
      });

      const trendData: MonthlyTrend[] = Object.entries(monthlyData).map(([month, data]) => ({
        month,
        visitors: data.visitors,
        born_again: data.born_again,
        conversion_rate: data.visitors > 0 ? (data.born_again / data.visitors) * 100 : 0,
      }));

      setMonthlyTrend(trendData);
    } catch (error) {
      console.error("Error loading monthly trend:", error);
    }
  };

  const exportToExcel = () => {
    if (!recentConverts.length) return;

    const exportData = recentConverts.map((convert) => ({
      "Name": convert.full_name,
      "Email": convert.email,
      "Phone": convert.phone || "N/A",
      "Conversion Date": format(new Date(convert.created_at), "PPP"),
      "First Visit": convert.first_visit_date ? format(new Date(convert.first_visit_date), "PPP") : "N/A",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Converts");
    XLSX.writeFile(wb, `conversion-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("Report exported successfully");
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-primary" />
              Conversion Dashboard
            </h1>
            <p className="text-muted-foreground">Track visitor to Born Again conversion funnel</p>
          </div>
        </div>
        <Button onClick={exportToExcel} disabled={!recentConverts.length}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Visitors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.total_visitors || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.monthly_visitors || 0} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Born Again Converts</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.total_born_again || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics?.monthly_born_again || 0} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.conversion_rate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">All-time average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Follow-ups</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.active_followups || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Pending visitor follow-ups</p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Funnel</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Visitors</span>
                <span className="font-bold">{metrics?.total_visitors || 0}</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: "100%" }} />
              </div>
              
              <div className="flex items-center justify-between mt-4">
                <span className="text-sm">Born Again</span>
                <span className="font-bold">{metrics?.total_born_again || 0}</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{ 
                    width: `${metrics?.conversion_rate || 0}%` 
                  }} 
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trend Chart */}
      {monthlyTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Conversion Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {monthlyTrend.map((month) => (
                <div key={month.month} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{month.month}</span>
                    <div className="flex gap-4 text-sm">
                      <span className="text-muted-foreground">
                        Visitors: <span className="font-bold text-foreground">{month.visitors}</span>
                      </span>
                      <span className="text-muted-foreground">
                        Born Again: <span className="font-bold text-green-600">{month.born_again}</span>
                      </span>
                      <span className="text-muted-foreground">
                        Rate: <span className="font-bold text-foreground">{month.conversion_rate.toFixed(1)}%</span>
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all" 
                      style={{ width: `${month.conversion_rate}%` }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Converts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Born Again Converts</CardTitle>
        </CardHeader>
        <CardContent>
          {recentConverts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No converts recorded yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4">Name</th>
                    <th className="text-left p-4">Contact</th>
                    <th className="text-left p-4">Conversion Date</th>
                    <th className="text-left p-4">First Visit</th>
                  </tr>
                </thead>
                <tbody>
                  {recentConverts.map((convert) => (
                    <tr key={convert.id} className="border-b hover:bg-accent/50">
                      <td className="p-4 font-medium">{convert.full_name}</td>
                      <td className="p-4">
                        <div className="text-sm">
                          <div>{convert.email}</div>
                          {convert.phone && (
                            <div className="text-muted-foreground">{convert.phone}</div>
                          )}
                        </div>
                      </td>
                      <td className="p-4">{format(new Date(convert.created_at), "PPP")}</td>
                      <td className="p-4">
                        {convert.first_visit_date
                          ? format(new Date(convert.first_visit_date), "PPP")
                          : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ConversionDashboard;
