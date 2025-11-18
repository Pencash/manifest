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
    navigate("/auth");
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

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-primary/20 hover:border-primary"
            onClick={() => navigate("/give")}
          >
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <HandHeart className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Record a Giving</CardTitle>
              <CardDescription>
                Record your tithes, offerings, and pledges
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Give Now</Button>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-secondary/20 hover:border-secondary"
            onClick={() => navigate("/testimony")}
          >
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mb-4">
                <MessageSquare className="w-6 h-6 text-secondary" />
              </div>
              <CardTitle>Share a Testimony</CardTitle>
              <CardDescription>
                Share how God has blessed you
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="secondary" className="w-full">Share</Button>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow border-accent/20 hover:border-accent"
            onClick={() => navigate("/prayer")}
          >
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                <MessageSquare className="w-6 h-6 text-accent" />
              </div>
              <CardTitle>Prayer Request</CardTitle>
              <CardDescription>
                Submit a prayer request to our team
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">Submit Request</Button>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow md:col-span-2 lg:col-span-3"
            onClick={() => navigate("/history")}
          >
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <History className="w-6 h-6 text-muted-foreground" />
              </div>
              <CardTitle>Giving History</CardTitle>
              <CardDescription>
                View all your past contributions and receipts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="w-full">View History</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
