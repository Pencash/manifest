import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveDataView, type ResponsiveDataViewRow } from "@/components/ResponsiveDataView";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Download, Users, Award, Search, ExternalLink, TrendingUp, TrendingDown, Minus, Calendar } from "lucide-react";
import * as XLSX from "xlsx";
import { hasAdminAccess } from "@/lib/roles";
import { format } from "date-fns";

interface MemberStats {
  member_id: string;
  member_name: string;
  total_invitations: number;
  pending: number;
  invited: number;
  confirmed: number;
  attended: number;
  conversion_rate: number;
  performance_score: number;
  events_participated: number;
  avg_per_event: number;
  trend: 'up' | 'down' | 'stable';
}

interface DetailedInvitation {
  service_name: string;
  service_date: string;
  mobiliser_name: string;
  invitee_name: string;
  invitee_phone: string;
  invitee_email: string | null;
  status: string;
  invited_at: string | null;
  confirmed_at: string | null;
  attended_at: string | null;
}

interface ServiceOption {
  id: string;
  name: string;
  service_date: string;
}

const MobilizationReport = () => {
  const navigate = useNavigate();
  const [memberStats, setMemberStats] = useState<MemberStats[]>([]);
  const [detailedInvitations, setDetailedInvitations] = useState<DetailedInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [conversionFilter, setConversionFilter] = useState("all");
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("all");

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!loading && services.length > 0) {
      loadMobilizationData(selectedServiceId);
    }
  }, [selectedServiceId]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/admin/auth");
      return;
    }

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

    await loadServices();
    loadMobilizationData("all");
  };

  const loadServices = async () => {
    // Get services that have member_invitations
    const { data: invitations } = await supabase
      .from("member_invitations")
      .select("target_service_id")
      .not("target_service_id", "is", null);

    if (!invitations || invitations.length === 0) {
      setServices([]);
      return;
    }

    const serviceIds = Array.from(new Set(invitations.map(inv => inv.target_service_id).filter(Boolean))) as string[];

    const { data: servicesData } = await supabase
      .from("services")
      .select("id, name, service_date")
      .in("id", serviceIds)
      .order("service_date", { ascending: false });

    if (servicesData) {
      setServices(servicesData);
    }
  };

  const loadMobilizationData = async (serviceFilter: string) => {
    setLoading(true);

    // Step 1: Get all invitations with service info
    let query = supabase
      .from("member_invitations")
      .select("id, member_id, invitee_name, invitee_phone, invitee_email, status, target_service_id, invited_at, confirmed_at, attended_at");

    if (serviceFilter !== "all") {
      query = query.eq("target_service_id", serviceFilter);
    }

    const { data: invitations, error } = await query;

    if (error) {
      console.error("Error loading invitations:", error);
      toast.error("Failed to load mobilization data");
      setLoading(false);
      return;
    }

    if (!invitations || invitations.length === 0) {
      setMemberStats([]);
      setDetailedInvitations([]);
      setLoading(false);
      return;
    }

    // Also get ALL invitations for events participated calculation (when filtering by service)
    type InvitationForStats = { id: string; member_id: string; status: string; target_service_id: string | null };
    let allInvitationsForStats: InvitationForStats[] = invitations.map(inv => ({
      id: inv.id,
      member_id: inv.member_id,
      status: inv.status,
      target_service_id: inv.target_service_id
    }));
    
    if (serviceFilter !== "all") {
      const { data: allData } = await supabase
        .from("member_invitations")
        .select("id, member_id, status, target_service_id");
      if (allData) {
        allInvitationsForStats = allData;
      }
    }

    // Step 2: Collect unique member IDs and service IDs
    const memberIds = Array.from(
      new Set(invitations.map((inv) => inv.member_id).filter(Boolean))
    ) as string[];

    const serviceIds = Array.from(
      new Set(invitations.map((inv) => inv.target_service_id).filter(Boolean))
    ) as string[];

    // Step 3: Fetch profiles and services
    const [profilesRes, servicesRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name").in("id", memberIds),
      serviceIds.length > 0 
        ? supabase.from("services").select("id, name, service_date").in("id", serviceIds)
        : Promise.resolve({ data: [] })
    ]);

    if (profilesRes.error) {
      console.error("Error loading profiles:", profilesRes.error);
      toast.error("Failed to load mobilization data");
      setLoading(false);
      return;
    }

    // Step 4: Create maps
    const profileMap = new Map<string, string>();
    profilesRes.data?.forEach((p) => {
      profileMap.set(p.id, p.full_name ?? "Unknown");
    });

    const serviceMap = new Map<string, { name: string; date: string }>();
    servicesRes.data?.forEach((s: any) => {
      serviceMap.set(s.id, { name: s.name, date: s.service_date });
    });

    // Step 5: Build detailed invitations for export
    const detailed: DetailedInvitation[] = invitations.map((inv: any) => {
      const service = inv.target_service_id ? serviceMap.get(inv.target_service_id) : null;
      return {
        service_name: service?.name || "Not specified",
        service_date: service?.date || "",
        mobiliser_name: profileMap.get(inv.member_id) ?? "Unknown",
        invitee_name: inv.invitee_name,
        invitee_phone: inv.invitee_phone,
        invitee_email: inv.invitee_email,
        status: inv.status,
        invited_at: inv.invited_at,
        confirmed_at: inv.confirmed_at,
        attended_at: inv.attended_at,
      };
    });

    setDetailedInvitations(detailed);

    // Step 6: Calculate events participated per member (from all invitations)
    const memberEventsMap = new Map<string, Set<string>>();
    const memberTotalInvitations = new Map<string, number>();
    
    allInvitationsForStats.forEach((inv) => {
      const memberId = inv.member_id;
      if (!memberId) return;
      
      if (!memberEventsMap.has(memberId)) {
        memberEventsMap.set(memberId, new Set());
        memberTotalInvitations.set(memberId, 0);
      }
      
      if (inv.target_service_id) {
        memberEventsMap.get(memberId)!.add(inv.target_service_id);
      }
      memberTotalInvitations.set(memberId, (memberTotalInvitations.get(memberId) || 0) + 1);
    });

    // Step 7: Group by member and calculate stats
    const statsMap = new Map<string, MemberStats>();

    invitations.forEach((inv: any) => {
      const memberId = inv.member_id;
      if (!memberId) return;

      const memberName = profileMap.get(memberId) ?? "Unknown";
      const eventsParticipated = memberEventsMap.get(memberId)?.size || 1;
      const totalAllInvitations = memberTotalInvitations.get(memberId) || 1;

      if (!statsMap.has(memberId)) {
        statsMap.set(memberId, {
          member_id: memberId,
          member_name: memberName,
          total_invitations: 0,
          pending: 0,
          invited: 0,
          confirmed: 0,
          attended: 0,
          conversion_rate: 0,
          performance_score: 0,
          events_participated: eventsParticipated,
          avg_per_event: 0,
          trend: 'stable',
        });
      }

      const stats = statsMap.get(memberId)!;
      stats.total_invitations++;

      switch (inv.status) {
        case "pending_invite":
          stats.pending++;
          break;
        case "invited":
          stats.invited++;
          break;
        case "confirmed":
          stats.confirmed++;
          break;
        case "attended":
          stats.attended++;
          break;
      }
    });

    // Step 8: Calculate performance scores, conversion rates, and trends
    const statsArray = Array.from(statsMap.values()).map((stat) => {
      // Calculate conversion rate
      const conversion_rate = stat.total_invitations > 0
        ? Math.round((stat.attended / stat.total_invitations) * 100)
        : 0;

      // Calculate performance score: (attended × 10) + (confirmed × 5) + (invited × 2) + pending
      const performance_score = (stat.attended * 10) + (stat.confirmed * 5) + (stat.invited * 2) + stat.pending;

      // Calculate average per event
      const avg_per_event = stat.events_participated > 0
        ? Math.round((stat.total_invitations / stat.events_participated) * 10) / 10
        : 0;

      // Determine trend based on conversion rate
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (conversion_rate >= 50) {
        trend = 'up';
      } else if (conversion_rate < 25 && stat.total_invitations > 2) {
        trend = 'down';
      }

      return {
        ...stat,
        conversion_rate,
        performance_score,
        avg_per_event,
        trend,
      };
    });

    // Sort by performance score (descending)
    statsArray.sort((a, b) => b.performance_score - a.performance_score);

    setMemberStats(statsArray);
    setLoading(false);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "dd MMM yyyy");
    } catch {
      return "-";
    }
  };

  const formatStatus = (status: string) => {
    return status.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getScoreBadgeColor = (score: number, rank: number) => {
    if (rank === 0) return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30";
    if (rank === 1) return "bg-gray-400/20 text-gray-700 dark:text-gray-300 border-gray-400/30";
    if (rank === 2) return "bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30";
    if (score >= 50) return "bg-green-500/10 text-green-700 dark:text-green-300";
    if (score >= 20) return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
    return "bg-gray-500/10 text-gray-700 dark:text-gray-300";
  };

  const exportToExcel = () => {
    // Create Summary Sheet with new metrics
    const summaryData = memberStats.map((stat, index) => ({
      "Rank": index + 1,
      "Member": stat.member_name,
      "Score": stat.performance_score,
      "Events": stat.events_participated,
      "Avg/Event": stat.avg_per_event,
      "Total Invitations": stat.total_invitations,
      "Pending": stat.pending,
      "Invited": stat.invited,
      "Confirmed": stat.confirmed,
      "Attended": stat.attended,
      "Success Rate": `${stat.conversion_rate}%`,
      "Trend": stat.trend === 'up' ? '↑' : stat.trend === 'down' ? '↓' : '→',
    }));

    const summarySheet = XLSX.utils.json_to_sheet(summaryData);

    // Create Details Sheet - Group by service like the uploaded format
    const serviceGroups = new Map<string, DetailedInvitation[]>();
    detailedInvitations.forEach(inv => {
      const key = inv.service_name;
      if (!serviceGroups.has(key)) {
        serviceGroups.set(key, []);
      }
      serviceGroups.get(key)!.push(inv);
    });

    // Build details data with service headers
    const detailsRows: any[] = [];
    serviceGroups.forEach((invs, serviceName) => {
      // Add service header row
      detailsRows.push({
        "Event/Service": serviceName,
        "Mobiliser": "",
        "Invitee Name": "",
        "Contact": "",
        "Email": "",
        "Status": "",
        "Invited Date": "",
        "Confirmed Date": "",
        "Attended Date": ""
      });
      
      // Add column headers
      detailsRows.push({
        "Event/Service": "",
        "Mobiliser": "MOBILISER",
        "Invitee Name": "INVITEE NAME",
        "Contact": "CONTACT",
        "Email": "EMAIL",
        "Status": "STATUS",
        "Invited Date": "INVITED DATE",
        "Confirmed Date": "CONFIRMED DATE",
        "Attended Date": "ATTENDED DATE"
      });

      // Add invitation rows
      invs.forEach(inv => {
        detailsRows.push({
          "Event/Service": "",
          "Mobiliser": inv.mobiliser_name,
          "Invitee Name": inv.invitee_name,
          "Contact": inv.invitee_phone,
          "Email": inv.invitee_email || "-",
          "Status": formatStatus(inv.status),
          "Invited Date": formatDate(inv.invited_at),
          "Confirmed Date": formatDate(inv.confirmed_at),
          "Attended Date": formatDate(inv.attended_at)
        });
      });

      // Add empty row between services
      detailsRows.push({});
    });

    const detailsSheet = XLSX.utils.json_to_sheet(detailsRows);

    // Create workbook with both sheets
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
    XLSX.utils.book_append_sheet(workbook, detailsSheet, "Details");
    
    XLSX.writeFile(workbook, `mobilization-report-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Report exported successfully!");
  };

  const filteredStats = memberStats.filter((stat) => {
    const matchesSearch = stat.member_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesConversion =
      conversionFilter === "all" ||
      (conversionFilter === "high" && stat.conversion_rate >= 50) ||
      (conversionFilter === "medium" && stat.conversion_rate >= 25 && stat.conversion_rate < 50) ||
      (conversionFilter === "low" && stat.conversion_rate < 25);
    return matchesSearch && matchesConversion;
  });

  const rankingRows: ResponsiveDataViewRow[] = useMemo(
    () =>
      filteredStats.map((stat, index) => ({
        id: stat.member_id,
        title: `${index + 1}. ${stat.member_name}`,
        subtitle: `${stat.events_participated} events · ${stat.total_invitations} total invitations`,
        desktopCells: [
          <span className="font-medium text-muted-foreground">{index + 1}</span>,
          <Link to={`/admin/mobilization/member/${stat.member_id}`} className="font-medium text-primary hover:underline flex items-center gap-1">
            {stat.member_name}
            <ExternalLink className="w-3 h-3" />
          </Link>,
          <Badge variant="outline" className={getScoreBadgeColor(stat.performance_score, index)}>
            {stat.performance_score}
          </Badge>,
          getTrendIcon(stat.trend),
          <span className="text-muted-foreground">{stat.events_participated}</span>,
          <span className="text-muted-foreground">{stat.avg_per_event}</span>,
          <span>{stat.total_invitations}</span>,
          <span className="font-semibold text-green-600 dark:text-green-400">{stat.attended}</span>,
          <Badge
            variant="outline"
            className={
              stat.conversion_rate >= 50
                ? "bg-green-500/10 text-green-700 dark:text-green-300"
                : stat.conversion_rate >= 25
                  ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300"
                  : "bg-gray-500/10 text-gray-700 dark:text-gray-300"
            }
          >
            {stat.conversion_rate}%
          </Badge>,
        ],
        essentials: [
          { label: "Status", value: <Badge variant="outline">{stat.conversion_rate}% success</Badge> },
          { label: "Person", value: stat.member_name },
          { label: "Score", value: <Badge variant="outline" className={getScoreBadgeColor(stat.performance_score, index)}>{stat.performance_score}</Badge> },
          { label: "Date", value: selectedServiceId === "all" ? "All events" : "Filtered event" },
        ],
        details: [
          { label: "Rank", value: index + 1 },
          { label: "Trend", value: getTrendIcon(stat.trend) },
          { label: "Events", value: stat.events_participated },
          { label: "Avg/Event", value: stat.avg_per_event },
          { label: "Total Invites", value: stat.total_invitations },
          { label: "Attended", value: stat.attended },
        ],
        actions: (
          <Button variant="outline" size="sm" onClick={() => navigate(`/admin/mobilization/member/${stat.member_id}`)}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Open Member
          </Button>
        ),
      })),
    [filteredStats, navigate, selectedServiceId],
  );

  const totalStats = {
    total_invitations: memberStats.reduce((sum, s) => sum + s.total_invitations, 0),
    total_invited: memberStats.reduce((sum, s) => sum + s.invited + s.confirmed + s.attended, 0),
    total_confirmed: memberStats.reduce((sum, s) => sum + s.confirmed + s.attended, 0),
    total_attended: memberStats.reduce((sum, s) => sum + s.attended, 0),
    active_members: memberStats.length,
    avg_conversion_rate: memberStats.length > 0
      ? Math.round(memberStats.reduce((sum, s) => sum + s.conversion_rate, 0) / memberStats.length)
      : 0,
  };

  const selectedServiceName = selectedServiceId === "all" 
    ? "All Events" 
    : services.find(s => s.id === selectedServiceId)?.name || "Selected Event";

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <Button variant="ghost" onClick={() => navigate("/admin/dashboard")} className="gap-2 w-fit">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
          <div className="flex items-center gap-3">
            {/* Event Filter */}
            <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
              <SelectTrigger className="w-full md:w-64">
                <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Filter by event" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                {services.map(service => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name} ({format(new Date(service.service_date), "MMM d, yyyy")})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={exportToExcel} className="gap-2">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Event Context Banner */}
        {selectedServiceId !== "all" && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-semibold text-foreground">Viewing: {selectedServiceName}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(services.find(s => s.id === selectedServiceId)?.service_date || ""), "EEEE, MMMM d, yyyy")}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedServiceId("all")}>
                View All Events
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Overall Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-foreground">{totalStats.total_invitations}</div>
              <div className="text-sm text-muted-foreground">Total Invitations</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-foreground">{totalStats.total_invited}</div>
              <div className="text-sm text-muted-foreground">Invited</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-indigo-500/10 to-blue-500/10">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-foreground">{totalStats.total_confirmed}</div>
              <div className="text-sm text-muted-foreground">Confirmed</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-foreground">{totalStats.total_attended}</div>
              <div className="text-sm text-muted-foreground">Attended</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-foreground">{totalStats.avg_conversion_rate}%</div>
              <div className="text-sm text-muted-foreground">Avg Success Rate</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-pink-500/10 to-rose-500/10">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-foreground">{totalStats.active_members}</div>
              <div className="text-sm text-muted-foreground">Active Members</div>
            </CardContent>
          </Card>
        </div>

        {/* Leaderboard */}
        {memberStats.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-500" />
                Top Mobilizers 🏆
              </CardTitle>
              <CardDescription>
                {selectedServiceId === "all" 
                  ? "Members leading the way in bringing friends to church" 
                  : `Top performers for ${selectedServiceName}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {memberStats.slice(0, 3).map((stat, index) => (
                  <Link
                    key={stat.member_id}
                    to={`/admin/mobilization/member/${stat.member_id}`}
                    className={`p-4 rounded-lg flex items-center gap-4 transition-all hover:scale-[1.01] hover:shadow-md cursor-pointer ${
                      index === 0
                        ? "bg-gradient-to-r from-yellow-500/20 to-yellow-500/5"
                        : index === 1
                        ? "bg-gradient-to-r from-gray-400/20 to-gray-400/5"
                        : "bg-gradient-to-r from-orange-500/20 to-orange-500/5"
                    }`}
                  >
                    <div className="text-3xl">
                      {index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉"}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold flex items-center gap-2">
                        {stat.member_name}
                        <ExternalLink className="w-3 h-3 text-muted-foreground" />
                        {getTrendIcon(stat.trend)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {stat.attended} attended · {stat.events_participated} events · {stat.avg_per_event} avg/event
                      </p>
                    </div>
                    <Badge variant="outline" className={`text-lg font-bold ${getScoreBadgeColor(stat.performance_score, index)}`}>
                      {stat.performance_score} pts
                    </Badge>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detailed Table */}
        <Card>
          <CardHeader>
            <CardTitle>Member Performance Report</CardTitle>
            <CardDescription>
              Ranked by performance score = (attended × 10) + (confirmed × 5) + (invited × 2) + pending
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by member name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={conversionFilter} onValueChange={setConversionFilter}>
                <SelectTrigger className="w-full md:w-52">
                  <SelectValue placeholder="Filter by success rate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Success Rates</SelectItem>
                  <SelectItem value="high">High (≥50%)</SelectItem>
                  <SelectItem value="medium">Medium (25-49%)</SelectItem>
                  <SelectItem value="low">Low (&lt;25%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {filteredStats.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {memberStats.length === 0 ? "No mobilization data yet" : "No members match your filters"}
                </p>
              </div>
            ) : (
              <ResponsiveDataView
                columns={["#", "Member", "Score", "Trend", "Events", "Avg/Event", "Total", "Attended", "Success Rate"]}
                rows={rankingRows}
                emptyState={<div />}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MobilizationReport;
