import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import { Download, Calendar as CalendarIcon, Users, DollarSign, MessageSquare, HandHeart, FileCheck, UserCog, Shield, TrendingUp, Receipt, FolderOpen } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import { hasAdminAccess } from "../lib/roles";

const AdminDashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>({});
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    checkUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/admin/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkUser = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        navigate("/admin/auth");
        return;
      }

      setUser(session.user);

      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Load ALL roles for this user (NOT single)
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      if (rolesError) throw rolesError;

      const mainRole =
        rolesData && rolesData.length > 0 ? rolesData[0].role : null;

      if (!hasAdminAccess(mainRole)) {
        toast.error("Access denied. Admin privileges required.");
        navigate("/dashboard");
        return;
      }

      // User is definitely admin / finance / pastor at this point
      await loadMetrics();
    } catch (error: any) {
      console.error("Error loading admin profile or role:", error);
      toast.error("Failed to load admin profile");
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async () => {
    try {
      // First get pending verifications count
      const { data: pendingVerificationsData } = await supabase
        .from("givings")
        .select("id, payment_reference, payment_method, status, receipts(verification_status)")
        .or("status.eq.pending,receipts.verification_status.eq.pending");

      const pendingCount = pendingVerificationsData?.filter((giving: any) => {
        const hasUploadedReceipt = giving.receipts?.some((r: any) => r.verification_status === "pending");
        const hasPendingMobilePayment = giving.payment_method === "mobile_money" && giving.payment_reference && giving.status === "pending";
        return hasUploadedReceipt || hasPendingMobilePayment;
      }).length || 0;

      const [givingsRes, profilesRes, attendanceRes, testimoniesRes, prayerRes, receiptsRes, givingTypesRes] = await Promise.all([
        supabase.from("givings").select("amount, giving_type_id, created_at"),
        supabase.from("profiles").select("id, is_active"),
        supabase.from("attendance").select("id"),
        supabase.from("testimonies").select("id"),
        supabase.from("prayer_requests").select("id"),
        supabase.from("receipts").select("id, verification_status"),
        supabase.from("giving_types").select("id, name"),
      ]);

              const totalGivings = givingsRes.data?.reduce((sum, g) => sum + Number(g.amount), 0) || 0;
              const activeMembers = profilesRes.data?.filter(p => p.is_active).length || 0;
              const totalAttendance = attendanceRes.data?.length || 0;
              const totalTestimonies = testimoniesRes.data?.length || 0;
              const totalPrayers = prayerRes.data?.length || 0;
              const pendingReceipts = receiptsRes.data?.filter(r => r.verification_status === 'pending').length || 0;

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
        pendingVerifications: pendingCount,
        givingsByType,
      });
    } catch (error: any) {
      console.error("Error loading metrics:", error);
      toast.error("Failed to load metrics");
    }
  };


  const createTestUsers = async () => {
    try {
      toast.loading("Creating test users...");
      const { data, error } = await supabase.functions.invoke('create-test-users');
      
      if (error) throw error;
      
      toast.dismiss();
      toast.success("Test users created successfully!");
      toast.info("Admin: admin@test.com / Admin123!");
      toast.info("Finance: finance@test.com / Finance123!");
    } catch (error: any) {
      toast.dismiss();
      toast.error(error.message || "Failed to create test users");
    }
  };

  const exportToExcel = async () => {
    if (!startDate || !endDate) {
      toast.error("Please select both start and end dates");
      return;
    }

    try {
      toast.loading("Preparing export...");
      
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      let givingsQuery = supabase
        .from("givings")
        .select(`
          *,
          profiles(full_name, email, phone),
          giving_types(name),
          services(name, service_date)
        `)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false });

      // Fetch attendance with explicit handling for profiles and contacts
      const { data: rawAttendance } = await supabase
        .from("attendance")
        .select("*, services(name, service_date)")
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      // Get unique profile IDs and contact IDs
      const profileIds = rawAttendance?.filter(a => a.profile_id).map(a => a.profile_id) || [];
      const contactIds = rawAttendance?.filter(a => a.contact_id).map(a => a.contact_id) || [];

      // Fetch profiles and contacts separately
      const [profilesData, contactsData] = await Promise.all([
        profileIds.length > 0
          ? supabase.from("profiles").select("id, full_name, email").in("id", profileIds)
          : Promise.resolve({ data: [] }),
        contactIds.length > 0
          ? supabase.from("contacts").select("id, full_name, email").in("id", contactIds)
          : Promise.resolve({ data: [] })
      ]);

      // Create lookup maps with proper typing
      const profilesMap = new Map<string, any>();
      profilesData.data?.forEach(p => profilesMap.set(p.id, p));
      
      const contactsMap = new Map<string, any>();
      contactsData.data?.forEach(c => contactsMap.set(c.id, c));

      let attendanceQuery = rawAttendance;

      let testimoniesQuery = supabase
        .from("testimonies")
        .select(`
          *,
          profiles(full_name, email),
          services(name, service_date)
        `)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      let prayersQuery = supabase
        .from("prayer_requests")
        .select(`
          *,
          profiles(full_name, email),
          services(name, service_date)
        `)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      const [givingsRes, testimoniesRes, prayersRes] = await Promise.all([
        givingsQuery,
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

      const attendanceData = attendanceQuery?.map(a => {
        let name = 'N/A';
        let email = 'N/A';
        
        if (a.profile_id) {
          const profile = profilesMap.get(a.profile_id);
          if (profile) {
            name = profile.full_name;
            email = profile.email || 'N/A';
          }
        } else if (a.contact_id) {
          const contact = contactsMap.get(a.contact_id);
          if (contact) {
            name = contact.full_name;
            email = contact.email;
          }
        }

        return {
          'Date': new Date(a.created_at).toLocaleDateString(),
          'Member': name,
          'Email': email,
          'Service': a.services?.name || 'N/A',
          'Status': a.status,
          'Count': a.count || 1,
        };
      }) || [];

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
      
      XLSX.writeFile(wb, `admin_export_${format(start, 'yyyy-MM-dd')}_to_${format(end, 'yyyy-MM-dd')}.xlsx`);
      
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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Admin Dashboard
        </h1>
        {profile && (
          <p className="text-sm text-muted-foreground mt-1">
            Welcome, {profile.full_name}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-0.5">
          Overview of all church activities and contributions
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card 
            className="group cursor-pointer hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-300 hover:scale-105 bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-background border-blue-500/20 overflow-hidden relative"
            onClick={() => navigate("/admin/events")}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-medium">Events & Services</CardTitle>
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors group-hover:rotate-12 duration-300">
                <CalendarIcon className="h-5 w-5 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">{metrics.activeMembers || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Manage calendar & attendance</p>
              <Button variant="link" className="p-0 h-auto mt-2 text-sm text-blue-600 hover:text-blue-700">
                Manage Events →
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="group cursor-pointer hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-300 hover:scale-105 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-background border-purple-500/20 overflow-hidden relative"
            onClick={() => navigate("/admin/users")}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-medium">User Management</CardTitle>
              <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors group-hover:scale-110 duration-300">
                <UserCog className="h-5 w-5 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">{metrics.activeMembers || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Manage roles & permissions</p>
              <Button variant="link" className="p-0 h-auto mt-2 text-sm text-purple-600 hover:text-purple-700">
                Manage Users →
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="group cursor-pointer hover:shadow-2xl hover:shadow-red-500/20 transition-all duration-300 hover:scale-105 bg-gradient-to-br from-red-500/10 via-red-500/5 to-background border-red-500/20 overflow-hidden relative"
            onClick={() => navigate("/admin/audit-logs")}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-medium">Security Audit Logs</CardTitle>
              <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors group-hover:scale-110 duration-300">
                <Shield className="h-5 w-5 text-red-500" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">Admin Only</div>
              <p className="text-xs text-muted-foreground mt-1">View security events & role changes</p>
              <Button variant="link" className="p-0 h-auto mt-2 text-sm text-red-600 hover:text-red-700">
                View Audit Logs →
              </Button>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-2xl hover:shadow-green-500/20 transition-all duration-300 hover:scale-105 bg-gradient-to-br from-green-500/10 via-green-500/5 to-background border-green-500/20 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 via-green-500/5 to-green-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-medium">Total Contributions</CardTitle>
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors group-hover:animate-bounce duration-300">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">MWK {metrics.totalGivings?.toLocaleString() || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-2xl hover:shadow-orange-500/20 transition-all duration-300 hover:scale-105 bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-background border-orange-500/20 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/5 to-orange-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-medium">Active Members</CardTitle>
              <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center group-hover:bg-orange-500/20 transition-colors group-hover:rotate-12 duration-300">
                <Users className="h-5 w-5 text-orange-500" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">{metrics.activeMembers || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Registered users</p>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-2xl hover:shadow-pink-500/20 transition-all duration-300 hover:scale-105 bg-gradient-to-br from-pink-500/10 via-pink-500/5 to-background border-pink-500/20 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-pink-500/0 via-pink-500/5 to-pink-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-medium">Testimonies</CardTitle>
              <div className="h-10 w-10 rounded-full bg-pink-500/10 flex items-center justify-center group-hover:bg-pink-500/20 transition-colors group-hover:scale-110 duration-300">
                <MessageSquare className="h-5 w-5 text-pink-500" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">{metrics.totalTestimonies || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Shared by members</p>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-2xl hover:shadow-indigo-500/20 transition-all duration-300 hover:scale-105 bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-background border-indigo-500/20 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/5 to-indigo-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-medium">Prayer Requests</CardTitle>
              <div className="h-10 w-10 rounded-full bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors group-hover:animate-pulse duration-300">
                <HandHeart className="h-5 w-5 text-indigo-500" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{metrics.totalPrayers || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Total requests</p>
            </CardContent>
          </Card>

          <Card 
            className="group cursor-pointer hover:shadow-2xl hover:shadow-yellow-500/20 transition-all duration-300 hover:scale-105 bg-gradient-to-br from-yellow-500/10 via-red-500/5 to-background border-yellow-500/20 overflow-hidden relative"
            onClick={() => navigate("/admin/receipts")}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/0 via-yellow-500/5 to-yellow-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-medium">Pending Receipts</CardTitle>
              <div className="h-10 w-10 rounded-full bg-yellow-500/10 flex items-center justify-center group-hover:bg-yellow-500/20 transition-colors group-hover:rotate-12 duration-300">
                <FileCheck className="h-5 w-5 text-yellow-600" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-red-600 bg-clip-text text-transparent">{metrics.pendingReceipts || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting verification</p>
              <Button variant="link" className="p-0 h-auto mt-2 text-sm text-yellow-600 hover:text-yellow-700">
                View All →
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8 overflow-hidden border-primary/10">
          <CardHeader className="bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/5">
            <CardTitle className="text-xl">Quick Actions</CardTitle>
            <CardDescription>Access key administrative features</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <button
                onClick={() => navigate("/admin/reports/attendance")}
                className="group relative p-4 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 hover:from-blue-500/10 hover:to-cyan-500/10 border border-blue-500/20 rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/20 text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                    <CalendarIcon className="h-6 w-6 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1">Attendance Reports</h3>
                    <p className="text-xs text-muted-foreground">View detailed service attendance</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => navigate("/admin/reminders")}
                className="group relative p-4 bg-gradient-to-br from-purple-500/5 to-pink-500/5 hover:from-purple-500/10 hover:to-pink-500/10 border border-purple-500/20 rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/20 text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                    <CalendarIcon className="h-6 w-6 text-purple-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1">Event Reminders</h3>
                    <p className="text-xs text-muted-foreground">Schedule automated notifications</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => navigate("/admin/visitor-followup")}
                className="group relative p-4 bg-gradient-to-br from-green-500/5 to-emerald-500/5 hover:from-green-500/10 hover:to-emerald-500/10 border border-green-500/20 rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-green-500/20 text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                    <UserCog className="h-6 w-6 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1">Visitor Follow-up</h3>
                    <p className="text-xs text-muted-foreground">Manage first-time visitors</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => navigate("/admin/bulk-attendance")}
                className="group relative p-4 bg-gradient-to-br from-orange-500/5 to-amber-500/5 hover:from-orange-500/10 hover:to-amber-500/10 border border-orange-500/20 rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-orange-500/20 text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                    <Users className="h-6 w-6 text-orange-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1">Bulk Import</h3>
                    <p className="text-xs text-muted-foreground">Import attendance from Excel</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => navigate("/history")}
                className="group relative p-4 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 hover:from-indigo-500/10 hover:to-purple-500/10 border border-indigo-500/20 rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/20 text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-lg bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
                    <DollarSign className="h-6 w-6 text-indigo-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1">Giving History</h3>
                    <p className="text-xs text-muted-foreground">View all contributions</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => navigate("/admin/verifications")}
                className="group relative p-4 bg-gradient-to-br from-yellow-500/5 to-orange-500/5 hover:from-yellow-500/10 hover:to-orange-500/10 border border-yellow-500/20 rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-yellow-500/20 text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-lg bg-yellow-500/10 flex items-center justify-center group-hover:bg-yellow-500/20 transition-colors">
                    <FileCheck className="h-6 w-6 text-yellow-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1">Pending Verifications</h3>
                    <p className="text-xs text-muted-foreground">Review receipts & payments ({metrics.pendingVerifications || 0})</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => navigate("/admin/reports/financial")}
                className="group relative p-4 bg-gradient-to-br from-green-500/5 to-emerald-500/5 hover:from-green-500/10 hover:to-emerald-500/10 border border-green-500/20 rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-green-500/20 text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                    <TrendingUp className="h-6 w-6 text-green-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1">Financial Reports</h3>
                    <p className="text-xs text-muted-foreground">Detailed giving analytics & exports</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => navigate("/admin/mobilization")}
                className="group relative p-4 bg-gradient-to-br from-teal-500/5 to-cyan-500/5 hover:from-teal-500/10 hover:to-cyan-500/10 border border-teal-500/20 rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-teal-500/20 text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-lg bg-teal-500/10 flex items-center justify-center group-hover:bg-teal-500/20 transition-colors">
                    <Users className="h-6 w-6 text-teal-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1">Mobilization Report</h3>
                    <p className="text-xs text-muted-foreground">Track member invitations</p>
                  </div>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>

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

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Export Data</CardTitle>
            <CardDescription>Download all data for a specific date range</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <Button onClick={exportToExcel} className="w-full" disabled={!startDate || !endDate}>
              <Download className="mr-2 h-4 w-4" />
              Download Excel Report
            </Button>
          </CardContent>
        </Card>
      </div>
  );
};

export default AdminDashboard;