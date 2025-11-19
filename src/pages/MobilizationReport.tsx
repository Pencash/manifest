import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Download, TrendingUp, Users, Target, Award } from "lucide-react";
import * as XLSX from "xlsx";

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
  const [userId, setUserId] = useState<string | undefined>();
  const { role, loading: roleLoading } = useUserRole(userId);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/admin/auth");
      return;
    }
    setUserId(session.user.id);
  };

  useEffect(() => {
    if (!roleLoading && role !== "admin" && role !== "pastor") {
      toast.error("Access denied. Admin or Pastor role required.");
      navigate("/dashboard");
      return;
    }

    if (!roleLoading && (role === "admin" || role === "pastor")) {
      loadMobilizationData();
    }
  }, [role, roleLoading]);

  const loadMobilizationData = async () => {
    setLoading(true);

    // Get all invitations with member info
    const { data: invitations, error } = await supabase
      .from("member_invitations")
      .select(`
        id,
        member_id,
        status,
        profiles!member_invitations_member_id_fkey(full_name)
      `);

    if (error) {
      toast.error("Failed to load mobilization data");
      setLoading(false);
      return;
    }

    // Group by member and calculate stats
    const statsMap = new Map<string, MemberStats>();

    invitations?.forEach((inv: any) => {
      const memberId = inv.member_id;
      const memberName = inv.profiles?.full_name || "Unknown";

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

    // Calculate conversion rates
    const statsArray = Array.from(statsMap.values()).map(stat => ({
      ...stat,
      conversion_rate: stat.total_invitations > 0
        ? Math.round((stat.attended / stat.total_invitations) * 100)
        : 0,
    }));

    // Sort by attended (descending)
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

  if (loading || roleLoading) {
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
            {memberStats.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No mobilization data yet</p>
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
                    {memberStats.map((stat) => (
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