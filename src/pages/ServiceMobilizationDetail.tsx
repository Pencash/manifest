import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Search, Download, Users, CalendarIcon, MapPin, Clock, UserCheck, Send, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { hasAdminAccess } from "@/lib/roles";
import * as XLSX from "xlsx";

interface Service {
  id: string;
  name: string;
  service_type: string;
  service_date: string;
  start_time: string | null;
  location: string | null;
}

interface Invitation {
  id: string;
  invitee_name: string;
  invitee_email: string | null;
  invitee_phone: string | null;
  status: string;
  invitation_method: string | null;
  invited_at: string | null;
  confirmed_at: string | null;
  attended_at: string | null;
  created_at: string;
  member_id: string;
  mobilizer_name?: string;
}

interface MemberProfile {
  id: string;
  full_name: string;
}

const serviceTypes: { [key: string]: string } = {
  'tuesday_fellowship': 'Tuesday Fellowship',
  'thursday_livestream': 'Thursday Livestream',
  'ltc': 'LTC',
  'sunday_service': 'Sunday Service',
  'gic': 'GIC',
  'nop': 'NOP',
  'men_gather': 'Men Gather',
  'mgp': 'MGP',
  'other': 'Other',
};

const ServiceMobilizationDetail = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [service, setService] = useState<Service | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mobilizerFilter, setMobilizerFilter] = useState("all");
  const [mobilizers, setMobilizers] = useState<MemberProfile[]>([]);

  useEffect(() => {
    checkAuthAndLoad();
  }, [serviceId]);

  const checkAuthAndLoad = async () => {
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

      const mainRole = rolesData && rolesData.length > 0 ? rolesData[0].role : null;

      if (!hasAdminAccess(mainRole)) {
        toast.error("Access denied. Admin privileges required.");
        navigate("/dashboard");
        return;
      }

      await loadData();
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    if (!serviceId) return;

    // Load service details
    const { data: serviceData, error: serviceError } = await supabase
      .from("services")
      .select("id, name, service_type, service_date, start_time, location")
      .eq("id", serviceId)
      .maybeSingle();

    if (serviceError) {
      console.error("Error loading service:", serviceError);
      toast.error("Failed to load service details");
      return;
    }

    if (!serviceData) {
      toast.error("Service not found");
      navigate("/admin/events");
      return;
    }

    setService(serviceData);

    // Load invitations for this service
    const { data: invitationsData, error: invitationsError } = await supabase
      .from("member_invitations")
      .select("*")
      .eq("target_service_id", serviceId)
      .order("created_at", { ascending: false });

    if (invitationsError) {
      console.error("Error loading invitations:", invitationsError);
      toast.error("Failed to load invitations");
      return;
    }

    // Get unique member IDs
    const memberIds = [...new Set(invitationsData?.map(inv => inv.member_id) || [])];

    // Load mobilizer profiles
    if (memberIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", memberIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p.full_name]) || []);
      setMobilizers(profilesData || []);

      // Enrich invitations with mobilizer names
      const enrichedInvitations = invitationsData?.map(inv => ({
        ...inv,
        mobilizer_name: profilesMap.get(inv.member_id) || "Unknown"
      })) || [];

      setInvitations(enrichedInvitations);
    } else {
      setInvitations([]);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: { className: string; label: string } } = {
      pending_invite: { className: "bg-yellow-500", label: "Pending" },
      invited: { className: "bg-blue-500", label: "Invited" },
      confirmed: { className: "bg-green-500", label: "Confirmed" },
      attended: { className: "bg-emerald-600", label: "Attended" },
      declined: { className: "bg-red-500", label: "Declined" },
    };
    const variant = variants[status] || { className: "bg-gray-500", label: status };
    return <Badge className={variant.className}>{variant.label}</Badge>;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return format(new Date(dateString), "MMM d, yyyy h:mm a");
  };

  const filteredInvitations = invitations.filter(inv => {
    const matchesSearch = 
      inv.invitee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.mobilizer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.invitee_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.invitee_phone?.includes(searchQuery);
    
    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    const matchesMobilizer = mobilizerFilter === "all" || inv.member_id === mobilizerFilter;

    return matchesSearch && matchesStatus && matchesMobilizer;
  });

  const stats = {
    total: invitations.length,
    pending: invitations.filter(i => i.status === "pending_invite").length,
    invited: invitations.filter(i => i.status === "invited").length,
    confirmed: invitations.filter(i => i.status === "confirmed").length,
    attended: invitations.filter(i => i.status === "attended").length,
    declined: invitations.filter(i => i.status === "declined").length,
  };

  const exportToExcel = () => {
    const exportData = filteredInvitations.map(inv => ({
      "Mobilizer": inv.mobilizer_name,
      "Invitee Name": inv.invitee_name,
      "Email": inv.invitee_email || "",
      "Phone": inv.invitee_phone || "",
      "Status": inv.status,
      "Method": inv.invitation_method || "",
      "Invited At": inv.invited_at ? format(new Date(inv.invited_at), "yyyy-MM-dd HH:mm") : "",
      "Confirmed At": inv.confirmed_at ? format(new Date(inv.confirmed_at), "yyyy-MM-dd HH:mm") : "",
      "Attended At": inv.attended_at ? format(new Date(inv.attended_at), "yyyy-MM-dd HH:mm") : "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invitations");
    XLSX.writeFile(wb, `${service?.name || "Service"}_Mobilization.xlsx`);
    toast.success("Exported to Excel successfully!");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/admin/events")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Events
        </Button>

        {/* Service Info Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-primary">
                    {serviceTypes[service?.service_type || ""] || service?.service_type}
                  </Badge>
                </div>
                <CardTitle className="text-2xl">{service?.name}</CardTitle>
                <CardDescription className="mt-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {service?.service_date && format(new Date(service.service_date), "PPPP")}
                  </div>
                  {service?.start_time && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {service.start_time}
                    </div>
                  )}
                  {service?.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {service.location}
                    </div>
                  )}
                </CardDescription>
              </div>
              <Button onClick={exportToExcel} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export to Excel
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Mobilized</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.invited}</p>
                  <p className="text-xs text-muted-foreground">Invited</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.confirmed}</p>
                  <p className="text-xs text-muted-foreground">Confirmed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.attended}</p>
                  <p className="text-xs text-muted-foreground">Attended</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.declined}</p>
                  <p className="text-xs text-muted-foreground">Declined</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending_invite">Pending</SelectItem>
                  <SelectItem value="invited">Invited</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="attended">Attended</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select>
              <Select value={mobilizerFilter} onValueChange={setMobilizerFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Mobilizer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Mobilizers</SelectItem>
                  {mobilizers.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Invitations Table */}
        <Card>
          <CardHeader>
            <CardTitle>Mobilization Details</CardTitle>
            <CardDescription>
              {filteredInvitations.length} invitation{filteredInvitations.length !== 1 ? "s" : ""} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mobilizer</TableHead>
                    <TableHead>Invitee</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Invited</TableHead>
                    <TableHead>Confirmed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvitations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No invitations found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredInvitations.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell>
                          <Link 
                            to={`/admin/mobilization/member/${inv.member_id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {inv.mobilizer_name}
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium">{inv.invitee_name}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {inv.invitee_phone && <div>{inv.invitee_phone}</div>}
                            {inv.invitee_email && <div className="text-muted-foreground">{inv.invitee_email}</div>}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(inv.status)}</TableCell>
                        <TableCell className="capitalize">{inv.invitation_method || "-"}</TableCell>
                        <TableCell className="text-sm">{formatDate(inv.invited_at)}</TableCell>
                        <TableCell className="text-sm">{formatDate(inv.confirmed_at)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ServiceMobilizationDetail;
