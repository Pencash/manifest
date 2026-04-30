import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Download, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { getHighestRole, hasAdminAccess } from "@/lib/roles";

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
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [minAttendance, setMinAttendance] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("date_desc");
  const [locations, setLocations] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    loadLocations();
  }, []);

  const loadLocations = async () => {
    const { data } = await supabase
      .from("services")
      .select("location")
      .not("location", "is", null)
      .eq("is_published", true);

    if (data) {
      const uniqueLocations = [...new Set(data.map(s => s.location).filter(Boolean))];
      setLocations(uniqueLocations as string[]);
    }
  };

  const setQuickDateRange = (range: string) => {
    const today = new Date();
    let start = new Date();
    
    const quarter = Math.floor(today.getMonth() / 3);

    switch (range) {
      case "7days":
        start.setDate(today.getDate() - 7);
        break;
      case "30days":
        start.setDate(today.getDate() - 30);
        break;
      case "month":
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
      case "quarter":
        start = new Date(today.getFullYear(), quarter * 3, 1);
        break;
      case "year":
        start = new Date(today.getFullYear(), 0, 1);
        break;
      default:
        break;
    }
    
    setStartDate(start);
    setEndDate(today);
  };

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate("/admin/auth");
        return;
      }

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      const mainRole = getHighestRole(rolesData?.map(({ role }) => role));

      if (!hasAdminAccess(mainRole)) {
        toast.error("Access denied. Admin privileges required.");
        navigate("/dashboard");
        return;
      }
    } catch (error) {
      console.error("Auth error:", error);
      navigate("/admin/auth");
    }
  };

  const generateReport = async () => {
    if (!startDate || !endDate) {
      toast.error("Please select both start and end dates");
      return;
    }

    setLoading(true);

    try {
      let query = supabase
        .from("services")
        .select("*")
        .gte("service_date", format(startDate, "yyyy-MM-dd"))
        .lte("service_date", format(endDate, "yyyy-MM-dd"))
        .eq("is_published", true);

      if (serviceTypeFilter !== "all") {
        query = query.eq("service_type", serviceTypeFilter as any);
      }

      if (locationFilter !== "all") {
        query = query.eq("location", locationFilter);
      }

      const { data: services, error } = await query.order("service_date", { ascending: false });

      if (error) throw error;

      const reportPromises = (services || []).map(async (service) => {
        // Use attendance_with_context view for resilient reporting with snapshot fallbacks
        const { data: attendance } = await supabase
          .from("attendance_with_context")
          .select("*")
          .eq("service_id", service.id)
          .eq("status", "present");

        const profileCount = attendance?.filter(a => a.profile_id).length || 0;
        
        const contactIds = attendance?.filter(a => a.contact_id).map(a => a.contact_id).filter(Boolean) || [];
        
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

        // Count orphaned records (no profile_id or contact_id but have snapshot data)
        const orphanedCount = attendance?.filter(a => !a.profile_id && !a.contact_id && a.person_name).length || 0;

        return {
          service_name: service.name,
          service_date: service.service_date,
          total_attendance: (attendance?.length || 0),
          profile_count: profileCount,
          contact_count: visitorCount + orphanedCount,
          born_again_count: bornAgainCount
        };
      });

      let processedData = await Promise.all(reportPromises);

      if (minAttendance && parseInt(minAttendance) > 0) {
        processedData = processedData.filter(r => r.total_attendance >= parseInt(minAttendance));
      }

      processedData.sort((a, b) => {
        const conversionSort = () => {
          const bRate = b.total_attendance > 0 ? (b.born_again_count / b.total_attendance) * 100 : 0;
          const aRate = a.total_attendance > 0 ? (a.born_again_count / a.total_attendance) * 100 : 0;
          return bRate - aRate;
        };

        switch (sortBy) {
          case "date_asc":
            return new Date(a.service_date).getTime() - new Date(b.service_date).getTime();
          case "date_desc":
            return new Date(b.service_date).getTime() - new Date(a.service_date).getTime();
          case "attendance_high":
            return b.total_attendance - a.total_attendance;
          case "attendance_low":
            return a.total_attendance - b.total_attendance;
          case "conversion_high":
            return conversionSort();
          default:
            return 0;
        }
      });

      setReportData(processedData);
      toast.success(`Report generated with ${processedData.length} service(s)`);
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

    const exportData = reportData.map((r) => ({
      "Service": r.service_name,
      "Date": format(new Date(r.service_date), "PPP"),
      "Total Attendance": r.total_attendance,
      "Members": r.profile_count,
      "Visitors": r.contact_count,
      "Born Again": r.born_again_count
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance Report");
    XLSX.writeFile(wb, `attendance-report-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("Report exported successfully");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/admin/dashboard")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Attendance Report</h1>
          <p className="text-muted-foreground">Generate detailed attendance reports with advanced filters</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Quick Date Presets */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setQuickDateRange("7days")}>
                Last 7 Days
              </Button>
              <Button size="sm" variant="outline" onClick={() => setQuickDateRange("30days")}>
                Last 30 Days
              </Button>
              <Button size="sm" variant="outline" onClick={() => setQuickDateRange("month")}>
                This Month
              </Button>
              <Button size="sm" variant="outline" onClick={() => setQuickDateRange("quarter")}>
                This Quarter
              </Button>
              <Button size="sm" variant="outline" onClick={() => setQuickDateRange("year")}>
                This Year
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Date Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date *</label>
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
                      {startDate ? format(startDate, "PPP") : <span>Pick start date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
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
                <label className="text-sm font-medium">End Date *</label>
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
                      {endDate ? format(endDate, "PPP") : <span>Pick end date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
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

              {/* Service Type Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Service Type</label>
                <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="sunday_service">Sunday Service</SelectItem>
                    <SelectItem value="tuesday_fellowship">Tuesday Fellowship</SelectItem>
                    <SelectItem value="thursday_livestream">Thursday Livestream</SelectItem>
                    <SelectItem value="ltc">LTC</SelectItem>
                    <SelectItem value="gic">GIC</SelectItem>
                    <SelectItem value="nop">NOP</SelectItem>
                    <SelectItem value="men_gather">Men Gather</SelectItem>
                    <SelectItem value="mgp">MGP</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Location Filter */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Location</label>
                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map(loc => (
                      <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Min Attendance */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Minimum Attendance</label>
                <Input
                  type="number"
                  placeholder="e.g., 50"
                  value={minAttendance}
                  onChange={(e) => setMinAttendance(e.target.value)}
                  min="0"
                />
              </div>

              {/* Sort By */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Sort By</label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date_desc">Date (Newest First)</SelectItem>
                    <SelectItem value="date_asc">Date (Oldest First)</SelectItem>
                    <SelectItem value="attendance_high">Attendance (High to Low)</SelectItem>
                    <SelectItem value="attendance_low">Attendance (Low to High)</SelectItem>
                    <SelectItem value="conversion_high">Conversion Rate (High to Low)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Generate Button */}
              <div className="space-y-2">
                <label className="text-sm font-medium">&nbsp;</label>
                <Button 
                  onClick={generateReport} 
                  disabled={loading || !startDate || !endDate}
                  className="w-full"
                >
                  {loading ? "Generating..." : "Generate Report"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {reportData.length > 0 && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={exportToExcel}
            >
              <Download className="mr-2 h-4 w-4" />
              Export to Excel
            </Button>
          </div>
        )}

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
                  <div className="text-2xl font-bold">
                    {reportData.reduce((sum, r) => sum + r.total_attendance, 0)}
                  </div>
                  <p className="text-sm text-muted-foreground">Total Attendance</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold">
                    {Math.round(reportData.reduce((sum, r) => sum + r.total_attendance, 0) / reportData.length)}
                  </div>
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
              <CardContent className="p-0">
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
                        <tr key={index} className="border-b hover:bg-accent/50">
                          <td className="p-4 font-medium">{row.service_name}</td>
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
