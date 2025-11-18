import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import { LogOut, Download, CalendarIcon, Users, DollarSign, MessageSquare, HandHeart, FileCheck } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";

const AdminDashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>({});
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const navigate = useNavigate();

  useEffect(() => {
    checkUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      
      setUser(session.user);
      
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error) throw error;
      
      if (profileData.role !== 'admin' && profileData.role !== 'finance' && profileData.role !== 'pastor') {
        toast.error("Access denied. Admin privileges required.");
        navigate("/dashboard");
        return;
      }
      
      setProfile(profileData);
      await loadMetrics();
    } catch (error: any) {
      console.error("Error loading profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async () => {
    try {
      const [givingsRes, profilesRes, attendanceRes, testimoniesRes, prayerRes, receiptsRes, givingTypesRes] = await Promise.all([
        supabase.from("givings").select("amount, giving_type_id, created_at"),
        supabase.from("profiles").select("id, is_active"),
        supabase.from("attendance").select("id"),
        supabase.from("testimonies").select("id"),
        supabase.from("prayer_requests").select("id"),
        supabase.from("receipts").select("id, parse_status"),
        supabase.from("giving_types").select("id, name"),
      ]);

      const totalGivings = givingsRes.data?.reduce((sum, g) => sum + Number(g.amount), 0) || 0;
      const activeMembers = profilesRes.data?.filter(p => p.is_active).length || 0;
      const totalAttendance = attendanceRes.data?.length || 0;
      const totalTestimonies = testimoniesRes.data?.length || 0;
      const totalPrayers = prayerRes.data?.length || 0;
      const pendingReceipts = receiptsRes.data?.filter(r => r.parse_status === 'pending').length || 0;

      const givingsByType: any = {};
      givingsRes.data?.forEach(g => {
        const type = givingTypesRes.data?.find(t => t.id === g.giving_type_id);
        const typeName = type?.name || 'Unknown';
        givingsByType[typeName] = (givingsByType[typeName] || 0) + Number(g.amount);
      });

      setMetrics({
        totalGivings,
        activeMembers,
        totalAttendance,
        totalTestimonies,
        totalPrayers,
        pendingReceipts,
        givingsByType,
      });
    } catch (error: any) {
      console.error("Error loading metrics:", error);
      toast.error("Failed to load metrics");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/auth");
  };

  const exportToExcel = async () => {
    if (!startDate || !endDate) {
      toast.error("Please select both start and end dates");
      return;
    }

    try {
      toast.loading("Preparing export...");
      
      let givingsQuery = supabase
        .from("givings")
        .select(`
          *,
          profiles(full_name, email, phone),
          giving_types(name),
          services(name, service_date)
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      let attendanceQuery = supabase
        .from("attendance")
        .select(`
          *,
          profiles(full_name, email),
          services(name, service_date)
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      let testimoniesQuery = supabase
        .from("testimonies")
        .select(`
          *,
          profiles(full_name, email),
          services(name, service_date)
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      let prayersQuery = supabase
        .from("prayer_requests")
        .select(`
          *,
          profiles(full_name, email),
          services(name, service_date)
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      const [givingsRes, attendanceRes, testimoniesRes, prayersRes] = await Promise.all([
        givingsQuery,
        attendanceQuery,
        testimoniesQuery,
        prayersQuery,
      ]);

      const givingsData = givingsRes.data?.map(g => ({
        'Date': new Date(g.created_at).toLocaleDateString(),
        'Donor': g.is_anonymous ? 'Anonymous' : g.profiles?.full_name || 'N/A',
        'Email': g.is_anonymous ? 'Anonymous' : g.profiles?.email || 'N/A',
        'Type': g.giving_types?.name || 'N/A',
        'Amount': g.amount,
        'Currency': g.currency,
        'Payment Method': g.payment_method,
        'Reference': g.payment_reference || 'N/A',
        'Service': g.services?.name || 'N/A',
        'Status': g.status,
      })) || [];

      const attendanceData = attendanceRes.data?.map(a => ({
        'Date': new Date(a.created_at).toLocaleDateString(),
        'Member': a.profiles?.full_name || 'N/A',
        'Email': a.profiles?.email || 'N/A',
        'Service': a.services?.name || 'N/A',
        'Status': a.status,
        'Count': a.count || 1,
      })) || [];

      const testimoniesData = testimoniesRes.data?.map(t => ({
        'Date': new Date(t.created_at).toLocaleDateString(),
        'Member': t.is_anonymous_to_congregation ? 'Anonymous' : t.profiles?.full_name || 'N/A',
        'Email': t.is_anonymous_to_congregation ? 'Anonymous' : t.profiles?.email || 'N/A',
        'Title': t.title || 'N/A',
        'Body': t.body,
        'Visibility': t.visibility,
        'Service': t.services?.name || 'N/A',
      })) || [];

      const prayersData = prayersRes.data?.map(p => ({
        'Date': new Date(p.created_at).toLocaleDateString(),
        'Member': p.is_anonymous_to_congregation ? 'Anonymous' : p.profiles?.full_name || 'N/A',
        'Email': p.is_anonymous_to_congregation ? 'Anonymous' : p.profiles?.email || 'N/A',
        'Title': p.title || 'N/A',
        'Body': p.body,
        'Answered': p.answered ? 'Yes' : 'No',
        'Visibility': p.visibility,
        'Service': p.services?.name || 'N/A',
      })) || [];

      const wb = XLSX.utils.book_new();
      
      const givingsWs = XLSX.utils.json_to_sheet(givingsData);
      const attendanceWs = XLSX.utils.json_to_sheet(attendanceData);
      const testimoniesWs = XLSX.utils.json_to_sheet(testimoniesData);
      const prayersWs = XLSX.utils.json_to_sheet(prayersData);
      
      XLSX.utils.book_append_sheet(wb, givingsWs, "Givings");
      XLSX.utils.book_append_sheet(wb, attendanceWs, "Attendance");
      XLSX.utils.book_append_sheet(wb, testimoniesWs, "Testimonies");
      XLSX.utils.book_append_sheet(wb, prayersWs, "Prayer Requests");
      
      XLSX.writeFile(wb, `admin_export_${format(startDate, 'yyyy-MM-dd')}_to_${format(endDate, 'yyyy-MM-dd')}.xlsx`);
      
      toast.dismiss();
      toast.success("Export completed successfully!");
    } catch (error: any) {
      toast.dismiss();
      console.error("Error exporting data:", error);
      toast.error("Failed to export data");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">
              Overview of all church activities and contributions
            </p>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Contributions</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">MWK {metrics.totalGivings?.toLocaleString() || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.activeMembers || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Registered users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Attendance</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalAttendance || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">All services</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Testimonies</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalTestimonies || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Shared by members</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Prayer Requests</CardTitle>
              <HandHeart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalPrayers || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Total requests</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Receipts</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.pendingReceipts || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting verification</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Contributions by Type</CardTitle>
            <CardDescription>Total amounts for each giving category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(metrics.givingsByType || {}).map(([type, amount]: [string, any]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{type}</span>
                  <span className="text-sm text-muted-foreground">MWK {Number(amount).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export Data</CardTitle>
            <CardDescription>Download all data for a specific date range</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <Button onClick={exportToExcel} className="w-full" disabled={!startDate || !endDate}>
              <Download className="mr-2 h-4 w-4" />
              Download Excel Report
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
