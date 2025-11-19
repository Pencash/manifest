import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import { HandHeart, MessageSquare, History, LogOut, Download } from "lucide-react";
import * as XLSX from "xlsx";

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/member/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate("/member/auth");
        return;
      }
      
      setUser(session.user);
      
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error) throw error;
      
      // Check user role from user_roles table
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();
      
      // Redirect admin/finance users to their dashboard
      if (roleData?.role === 'admin' || roleData?.role === 'finance' || roleData?.role === 'pastor') {
        navigate("/admin/dashboard");
        return;
      }
      
      setProfile(profileData);
    } catch (error: any) {
      console.error("Error loading profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/member/auth");
  };

  const exportToExcel = async () => {
    try {
      toast.loading("Preparing export...");
      
      const { data: givingsData } = await supabase
        .from("givings")
        .select(`
          *,
          giving_types(name),
          services(name, service_date)
        `)
        .eq('profile_id', user?.id)
        .order('created_at', { ascending: false });

      const { data: attendanceData } = await supabase
        .from("attendance")
        .select(`
          *,
          services(name, service_date)
        `)
        .eq('profile_id', user?.id);

      const givingsSheet = givingsData?.map(g => ({
        'Date': new Date(g.created_at).toLocaleDateString(),
        'Type': g.giving_types?.name || 'N/A',
        'Amount': g.amount,
        'Currency': g.currency,
        'Payment Method': g.payment_method,
        'Reference': g.payment_reference || 'N/A',
        'Service': g.services?.name || 'N/A',
        'Status': g.status,
      })) || [];

      const attendanceSheet = attendanceData?.map(a => ({
        'Date': new Date(a.created_at).toLocaleDateString(),
        'Service': a.services?.name || 'N/A',
        'Status': a.status,
        'Count': a.count || 1,
      })) || [];

      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.json_to_sheet(givingsSheet);
      const ws2 = XLSX.utils.json_to_sheet(attendanceSheet);
      
      XLSX.utils.book_append_sheet(wb, ws1, "Giving History");
      XLSX.utils.book_append_sheet(wb, ws2, "Attendance");
      
      XLSX.writeFile(wb, `my_records_${new Date().toISOString().split('T')[0]}.xlsx`);
      
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
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Welcome, {profile?.full_name || user?.email}
            </h1>
            <p className="text-muted-foreground mt-1">
              Your giving dashboard for Phaneroo
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToExcel}>
              <Download className="mr-2 h-4 w-4" />
              Download Excel
            </Button>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card 
            className="group relative overflow-hidden border-2 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 hover:from-blue-500/20 hover:to-cyan-500/20 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/20 hover:border-blue-500/50 transition-all duration-300 cursor-pointer"
            onClick={() => navigate("/give")}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
            <CardHeader className="relative z-10">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-blue-500/20 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                  <HandHeart className="h-7 w-7 text-blue-600" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl group-hover:text-blue-600 transition-colors">Record a Giving</CardTitle>
                  <CardDescription className="mt-2">Submit your tithes and offerings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <Button className="w-full bg-blue-600 hover:bg-blue-700">Give Now</Button>
            </CardContent>
          </Card>

          <Card 
            className="group relative overflow-hidden border-2 bg-gradient-to-br from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 hover:scale-105 hover:shadow-xl hover:shadow-purple-500/20 hover:border-purple-500/50 transition-all duration-300 cursor-pointer"
            onClick={() => navigate("/testimony")}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
            <CardHeader className="relative z-10">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-purple-500/20 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-300">
                  <MessageSquare className="h-7 w-7 text-purple-600" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl group-hover:text-purple-600 transition-colors">Share a Testimony</CardTitle>
                  <CardDescription className="mt-2">Share your faith journey</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <Button className="w-full bg-purple-600 hover:bg-purple-700">Share</Button>
            </CardContent>
          </Card>

          <Card 
            className="group relative overflow-hidden border-2 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 hover:from-indigo-500/20 hover:to-blue-500/20 hover:scale-105 hover:shadow-xl hover:shadow-indigo-500/20 hover:border-indigo-500/50 transition-all duration-300 cursor-pointer"
            onClick={() => navigate("/prayer")}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
            <CardHeader className="relative z-10">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-indigo-500/20 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                  <HandHeart className="h-7 w-7 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl group-hover:text-indigo-600 transition-colors">Prayer Request</CardTitle>
                  <CardDescription className="mt-2">Submit your prayer needs</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700">Request Prayer</Button>
            </CardContent>
          </Card>

          <Card 
            className="group relative overflow-hidden border-2 bg-gradient-to-br from-green-500/10 to-emerald-500/10 hover:from-green-500/20 hover:to-emerald-500/20 hover:scale-105 hover:shadow-xl hover:shadow-green-500/20 hover:border-green-500/50 transition-all duration-300 cursor-pointer"
            onClick={() => navigate("/history")}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500" />
            <CardHeader className="relative z-10">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-green-500/20 group-hover:scale-110 group-hover:-rotate-6 transition-all duration-300">
                  <History className="h-7 w-7 text-green-600" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl group-hover:text-green-600 transition-colors">Giving History</CardTitle>
                  <CardDescription className="mt-2">View your contribution records</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <Button variant="outline" className="w-full border-green-600 text-green-600 hover:bg-green-600 hover:text-white">View History</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
