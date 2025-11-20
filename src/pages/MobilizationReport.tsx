import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Download, TrendingUp, Users, Target, Award, Search } from "lucide-react";
import * as XLSX from "xlsx";
import { hasAdminAccess } from "../lib/roles";

interface MemberStats {
  member_id: string;
  member_name: string;
  total_invitations: number;
  pending: number;
  invited: number;
  confirmed: number;
  attended: number;
  conversion_rate: number;
}

const MobilizationReport = () => {
  const navigate = useNavigate();
  const [memberStats, setMemberStats] = useState<MemberStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [conversionFilter, setConversionFilter] = useState("all");

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
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

    // Role verified - load data
    loadMobilizationData();
  };

  const loadMobilizationData = async () => {
    setLoading(true);

    // Step 1: Get all invitations (no join to profiles)
    const { data: invitations, error } = await supabase
      .from("member_invitations")
      .select("id, member_id, status");

    if (error) {
      console.error("Error loading invitations:", error);
      toast.error("Failed to load mobilization data");
      setLoading(false);
      return;
    }

    if (!invitations || invitations.length === 0) {
      setMemberStats([]);
      setLoading(false);
      return;
    }

    // Step 2: Collect unique member IDs
    const memberIds = Array.from(
      new Set(invitations.map((inv) => inv.member_id).filter(Boolean))
    ) as string[];

    // Step 3: Fetch profiles for those member IDs
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", memberIds);

    if (profilesError) {
      console.error("Error loading profiles:", profilesError);
      toast.error("Failed to load mobilization data");
      setLoading(false);
      return;
    }

    // Step 4: Create profile map
    const profileMap = new Map<string, string>();
    profiles?.forEach((p) => {
      profileMap.set(p.id, p.full_name ?? "Unknown");
    });

    // Step 5: Group by member and calculate stats
    const statsMap = new Map<string, MemberStats>();

    invitations.forEach((inv: any) => {
      const memberId = inv.member_id;
      if (!memberId) return;

      const memberName = profileMap.get(memberId) ?? "Unknown";

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

    // Step 6: Calculate conversion rates and sort
    const statsArray = Array.from(statsMap.values()).map((stat) => ({
      ...stat,
      conversion_rate:
        stat.total_invitations > 0
          ? Math.round((stat.attended / stat.total_invitations) * 100)
          : 0,
    }));

    statsArray.sort((a, b) => b.attended - a.attended);

    setMemberStats(statsArray);
    setLoading(false);
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      memberStats.map(stat => ({
        "Member": stat.member_name,
        "Total Invitations": stat.total_invitations,
        "Pending": stat.pending,
        "Invited": stat.invited,
        "Confirmed": stat.confirmed,
        "Attended": stat.attended,
        "Conversion Rate": `${stat.conversion_rate}%`,
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Mobilization Report");
    XLSX.writeFile(workbook, `mobilization-report-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Report exported successfully!");
  };

  // Filter member stats based on search and conversion filter
  const filteredStats = memberStats.filter((stat) => {
    const matchesSearch = stat.member_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesConversion =
      conversionFilter === "all" ||
      (conversionFilter === "high" && stat.conversion_rate >= 50) ||
      (conversionFilter === "medium" && stat.conversion_rate >= 25 && stat.conversion_rate < 50) ||
      (conversionFilter === "low" && stat.conversion_rate < 25);
    return matchesSearch && matchesConversion;
  });

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
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/admin/dashboard")} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
          <Button onClick={exportToExcel} className="gap-2">
            <Download className="w-4 h-4" />
            Export to Excel
          </Button>
        </div>

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
              <CardDescription>Members leading the way in bringing friends to church</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {memberStats.slice(0, 3).map((stat, index) => (
                  <div
                    key={stat.member_id}
                    className={`p-4 rounded-lg flex items-center gap-4 ${
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
                      <p className="font-semibold">{stat.member_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {stat.attended} attended · {stat.confirmed} confirmed · {stat.conversion_rate}% success rate
                      </p>
                    </div>
                    <Badge variant="outline" className="text-lg">
                      {stat.attended}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detailed Table */}
        <Card>
          <CardHeader>
            <CardTitle>Member Performance Report</CardTitle>
            <CardDescription>Detailed breakdown of all member mobilization activities</CardDescription>
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
                <SelectTrigger className="w-full md:w-[200px]">
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">Pending</TableHead>
                      <TableHead className="text-center">Invited</TableHead>
                      <TableHead className="text-center">Confirmed</TableHead>
                      <TableHead className="text-center">Attended</TableHead>
                      <TableHead className="text-center">Success Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStats.map((stat) => (
                      <TableRow key={stat.member_id}>
                        <TableCell className="font-medium">{stat.member_name}</TableCell>
                        <TableCell className="text-center">{stat.total_invitations}</TableCell>
                        <TableCell className="text-center">{stat.pending}</TableCell>
                        <TableCell className="text-center">{stat.invited}</TableCell>
                        <TableCell className="text-center">{stat.confirmed}</TableCell>
                        <TableCell className="text-center font-semibold text-green-600 dark:text-green-400">
                          {stat.attended}
                        </TableCell>
                        <TableCell className="text-center">
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
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MobilizationReport;