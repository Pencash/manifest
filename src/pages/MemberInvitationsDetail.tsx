import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Download, User, Phone, Mail, Calendar, Search, Users } from "lucide-react";
import * as XLSX from "xlsx";
import { hasAdminAccess } from "@/lib/roles";
import { format } from "date-fns";

interface Invitation {
  id: string;
  invitee_name: string;
  invitee_phone: string;
  invitee_email: string | null;
  status: string;
  invitation_method: string | null;
  target_service_id: string | null;
  service_name?: string;
  service_date?: string;
  invited_at: string | null;
  confirmed_at: string | null;
  attended_at: string | null;
  notes: string | null;
  created_at: string;
}

interface MemberInfo {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
}

const MemberInvitationsDetail = () => {
  const navigate = useNavigate();
  const { memberId } = useParams<{ memberId: string }>();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [memberInfo, setMemberInfo] = useState<MemberInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [services, setServices] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    checkAuth();
  }, [memberId]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/admin/auth");
      return;
    }

    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);

    const mainRole = rolesData && rolesData.length > 0 ? rolesData[0].role : null;

    if (!hasAdminAccess(mainRole)) {
      toast.error("Access denied. Admin privileges required.");
      navigate("/dashboard");
      return;
    }

    loadData();
  };

  const loadData = async () => {
    if (!memberId) return;
    setLoading(true);

    // Fetch member info
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone")
      .eq("id", memberId)
      .single();

    if (profileError) {
      console.error("Error loading member:", profileError);
      toast.error("Failed to load member details");
      setLoading(false);
      return;
    }

    setMemberInfo(profile);

    // Fetch all invitations for this member
    const { data: invitationsData, error: invError } = await supabase
      .from("member_invitations")
      .select("*")
      .eq("member_id", memberId)
      .order("created_at", { ascending: false });

    if (invError) {
      console.error("Error loading invitations:", invError);
      toast.error("Failed to load invitations");
      setLoading(false);
      return;
    }

    // Get unique service IDs
    const serviceIds = Array.from(
      new Set(invitationsData?.map(inv => inv.target_service_id).filter(Boolean))
    ) as string[];

    // Fetch service details
    const servicesMap = new Map<string, { name: string; date: string }>();
    if (serviceIds.length > 0) {
      const { data: servicesData } = await supabase
        .from("services")
        .select("id, name, service_date")
        .in("id", serviceIds);

      servicesData?.forEach(s => {
        servicesMap.set(s.id, { name: s.name, date: s.service_date });
      });

      setServices(servicesData?.map(s => ({ id: s.id, name: s.name })) || []);
    }

    // Merge service info into invitations
    const enrichedInvitations = invitationsData?.map(inv => ({
      ...inv,
      service_name: inv.target_service_id ? servicesMap.get(inv.target_service_id)?.name : undefined,
      service_date: inv.target_service_id ? servicesMap.get(inv.target_service_id)?.date : undefined,
    })) || [];

    setInvitations(enrichedInvitations);
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      pending_invite: { label: "Pending", className: "bg-gray-500/10 text-gray-700 dark:text-gray-300" },
      invited: { label: "Invited", className: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
      confirmed: { label: "Confirmed", className: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300" },
      attended: { label: "Attended", className: "bg-green-500/10 text-green-700 dark:text-green-300" },
      declined: { label: "Declined", className: "bg-red-500/10 text-red-700 dark:text-red-300" },
    };

    const config = statusConfig[status] || { label: status, className: "bg-gray-500/10 text-gray-700" };
    return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "dd MMM yyyy");
    } catch {
      return "-";
    }
  };

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      filteredInvitations.map(inv => ({
        "Invitee Name": inv.invitee_name,
        "Phone": inv.invitee_phone,
        "Email": inv.invitee_email || "-",
        "Target Event": inv.service_name || "Not specified",
        "Event Date": inv.service_date ? formatDate(inv.service_date) : "-",
        "Status": inv.status.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase()),
        "Invited Date": formatDate(inv.invited_at),
        "Confirmed Date": formatDate(inv.confirmed_at),
        "Attended Date": formatDate(inv.attended_at),
        "Method": inv.invitation_method || "-",
        "Notes": inv.notes || "-",
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${memberInfo?.full_name || "Member"} Invitations`);
    XLSX.writeFile(workbook, `${memberInfo?.full_name || "member"}-invitations-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Invitations exported successfully!");
  };

  const filteredInvitations = invitations.filter(inv => {
    const matchesSearch = inv.invitee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.invitee_phone.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    const matchesService = serviceFilter === "all" || inv.target_service_id === serviceFilter;
    return matchesSearch && matchesStatus && matchesService;
  });

  const stats = {
    total: invitations.length,
    pending: invitations.filter(i => i.status === "pending_invite").length,
    invited: invitations.filter(i => i.status === "invited").length,
    confirmed: invitations.filter(i => i.status === "confirmed").length,
    attended: invitations.filter(i => i.status === "attended").length,
    declined: invitations.filter(i => i.status === "declined").length,
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
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Button variant="ghost" onClick={() => navigate("/admin/mobilization")} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Report
          </Button>
          <Button onClick={exportToExcel} className="gap-2">
            <Download className="w-4 h-4" />
            Export to Excel
          </Button>
        </div>

        {/* Member Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              {memberInfo?.full_name}
            </CardTitle>
            <CardDescription className="flex flex-wrap gap-4 mt-2">
              {memberInfo?.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-4 h-4" /> {memberInfo.phone}
                </span>
              )}
              {memberInfo?.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-4 h-4" /> {memberInfo.email}
                </span>
              )}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-foreground">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-gray-500/10 to-slate-500/10">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-foreground">{stats.pending}</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-foreground">{stats.invited}</div>
              <div className="text-sm text-muted-foreground">Invited</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-foreground">{stats.confirmed}</div>
              <div className="text-sm text-muted-foreground">Confirmed</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-foreground">{stats.attended}</div>
              <div className="text-sm text-muted-foreground">Attended</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500/10 to-rose-500/10">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-foreground">{stats.declined}</div>
              <div className="text-sm text-muted-foreground">Declined</div>
            </CardContent>
          </Card>
        </div>

        {/* Invitations Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Invited People
            </CardTitle>
            <CardDescription>All people invited by {memberInfo?.full_name}</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending_invite">Pending</SelectItem>
                  <SelectItem value="invited">Invited</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="attended">Attended</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select>
              {services.length > 0 && (
                <Select value={serviceFilter} onValueChange={setServiceFilter}>
                  <SelectTrigger className="w-full md:w-48">
                    <SelectValue placeholder="Event" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    {services.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {filteredInvitations.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  {invitations.length === 0 ? "No invitations found" : "No invitations match your filters"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invitee</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Target Event</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Invited</TableHead>
                      <TableHead className="text-center">Confirmed</TableHead>
                      <TableHead className="text-center">Attended</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvitations.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell>
                          <div className="font-medium">{inv.invitee_name}</div>
                          {inv.invitee_email && (
                            <div className="text-sm text-muted-foreground">{inv.invitee_email}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-muted-foreground" />
                            {inv.invitee_phone}
                          </div>
                        </TableCell>
                        <TableCell>
                          {inv.service_name ? (
                            <div>
                              <div className="font-medium">{inv.service_name}</div>
                              <div className="text-sm text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(inv.service_date || null)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Not specified</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">{getStatusBadge(inv.status)}</TableCell>
                        <TableCell className="text-center text-sm">{formatDate(inv.invited_at)}</TableCell>
                        <TableCell className="text-center text-sm">{formatDate(inv.confirmed_at)}</TableCell>
                        <TableCell className="text-center text-sm">{formatDate(inv.attended_at)}</TableCell>
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

export default MemberInvitationsDetail;
