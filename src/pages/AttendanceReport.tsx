import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { ArrowLeft, Download, CalendarIcon, BarChart3 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { hasAdminAccess } from "../lib/roles";

interface AttendanceData {
  service_name: string;
  service_date: string;
  total_attendance: number;
  profile_count: number;
  contact_count: number;
  born_again_count: number;
}

const AttendanceReport = () => {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reportData, setReportData] = useState<AttendanceData[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate("/admin/auth");
        return;
      }

      // Load ALL roles for this user (NOT single)
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      if (rolesError) {
        console.error("Error loading roles:", rolesError);
      }

      const mainRole = rolesData && rolesData.length > 0 ? rolesData[0].role : null;

      if (!hasAdminAccess(mainRole)) {
        toast.error("Access denied. Admin privileges required.");
        navigate("/dashboard");
        return;
      }
    } catch (error: any) {
      console.error("Error:", error);
      toast.error("Failed to verify access");
    }
  };

  const generateReport = async () => {
    if (!startDate || !endDate) {
      toast.error("Please select both start and end dates");
      return;
    }

    try {
      setLoading(true);

      // Fetch services in date range
      const { data: services, error: servicesError } = await supabase
        .from("services")
        .select("id, name, service_date, total_attendance")
        .gte("service_date", format(startDate, "yyyy-MM-dd"))
        .lte("service_date", format(endDate, "yyyy-MM-dd"))
        .order("service_date", { ascending: false });

      if (servicesError) throw servicesError;

      // Get attendance details for each service
      const reportPromises = services.map(async (service) => {
        const { data: attendance } = await supabase
          .from("attendance")
          .select("profile_id, contact_id")
          .eq("service_id", service.id)
          .eq("status", "present");

        const profileCount = attendance?.filter(a => a.profile_id).length || 0;
        
        // For contacts, we need to fetch their contact_type
        const contactIds = attendance?.filter(a => a.contact_id).map(a => a.contact_id) || [];
        
        let visitorCount = 0;
        let bornAgainCount = 0;
        
        if (contactIds.length > 0) {
          const { data: contacts } = await supabase
            .from("contacts")
            .select("id, contact_type")
            .in("id", contactIds);
          
          visitorCount = contacts?.filter(c => c.contact_type === 'visitor').length || 0;
          bornAgainCount = contacts?.filter(c => c.contact_type === 'born_again').length || 0;
        }

        return {
          service_name: service.name,
          service_date: service.service_date,
          total_attendance: service.total_attendance || 0,
          profile_count: profileCount,
          contact_count: visitorCount,
          born_again_count: bornAgainCount
        };
      });

      const data = await Promise.all(reportPromises);
      setReportData(data);
      toast.success("Report generated successfully");
    } catch (error: any) {
      console.error("Error generating report:", error);
      toast.error("Failed to generate report");
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    if (reportData.length === 0) {
      toast.error("No data to export");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(
      reportData.map(r => ({
        "Service Name": r.service_name,
        "Date": format(new Date(r.service_date), "PPP"),
        "Total Attendance": r.total_attendance,
        "Members": r.profile_count,
        "Visitors": r.contact_count,
        "Born Again": r.born_again_count
      }))
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance Report");
    XLSX.writeFile(wb, `attendance_report_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("Report exported successfully");
  };

  const totalAttendance = reportData.reduce((sum, r) => sum + r.total_attendance, 0);
  const avgAttendance = reportData.length > 0 ? Math.round(totalAttendance / reportData.length) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/admin/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              Attendance Report
            </CardTitle>
            <CardDescription>
              Generate attendance reports for a specific date range
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Start Date</label>
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
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">End Date</label>
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
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex gap-4">
              <Button onClick={generateReport} disabled={loading} className="flex-1">
                Generate Report
              </Button>
              {reportData.length > 0 && (
                <Button onClick={exportToExcel} variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Export to Excel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {reportData.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{reportData.length}</div>
                  <p className="text-sm text-muted-foreground">Total Services</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{totalAttendance}</div>
                  <p className="text-sm text-muted-foreground">Total Attendance</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">{avgAttendance}</div>
                  <p className="text-sm text-muted-foreground">Average Attendance</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">
                    {reportData.reduce((sum, r) => sum + r.born_again_count, 0)}
                  </div>
                  <p className="text-sm text-muted-foreground">Total Born Again</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Report Data</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-4">Service</th>
                        <th className="text-left p-4">Date</th>
                        <th className="text-right p-4">Total</th>
                        <th className="text-right p-4">Members</th>
                        <th className="text-right p-4">Visitors</th>
                        <th className="text-right p-4">Born Again</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.map((row, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="p-4">{row.service_name}</td>
                          <td className="p-4">{format(new Date(row.service_date), "PPP")}</td>
                          <td className="p-4 text-right">{row.total_attendance}</td>
                          <td className="p-4 text-right">{row.profile_count}</td>
                          <td className="p-4 text-right">{row.contact_count}</td>
                          <td className="p-4 text-right">{row.born_again_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default AttendanceReport;
