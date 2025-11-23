import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Plus, Phone, MessageCircle, Check, UserPlus, Calendar, TrendingUp, Mail } from "lucide-react";
import { format } from "date-fns";
import { BulkActionBar } from "@/components/BulkActionBar";

interface Invitation {
  id: string;
  invitee_name: string;
  invitee_phone: string;
  invitee_email?: string;
  status: string;
  invitation_method?: string;
  notes?: string;
  invited_at?: string;
  confirmed_at?: string;
  attended_at?: string;
  created_at: string;
  target_service_id?: string;
  services?: {
    name: string;
    service_date: string;
  };
}

const MemberMobilization = () => {
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    invitee_name: "",
    invitee_phone: "",
    invitee_email: "",
    target_service_id: "",
    invitation_method: "",
    notes: "",
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    checkAuth();
    loadData();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/member/auth");
    }
  };

  const loadData = async () => {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [invitationsRes, servicesRes] = await Promise.all([
      supabase
        .from("member_invitations")
        .select("*, services(name, service_date)")
        .eq("member_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("services")
        .select("*")
        .eq("is_published", true)
        .gte("service_date", new Date().toISOString().split('T')[0])
        .order("service_date", { ascending: true})
        .limit(20)
    ]);

    if (invitationsRes.data) setInvitations(invitationsRes.data);
    if (servicesRes.data) setServices(servicesRes.data);
    setLoading(false);
  };

  const handleAddInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.invitee_name || !formData.invitee_phone) {
      toast.error("Name and phone are required");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("member_invitations").insert({
        member_id: user.id,
        invitee_name: formData.invitee_name,
        invitee_phone: formData.invitee_phone,
        invitee_email: formData.invitee_email || null,
        target_service_id: formData.target_service_id || null,
        invitation_method: formData.invitation_method || null,
        notes: formData.notes || null,
        status: "pending_invite"
      });

      if (error) throw error;

      toast.success("Invitation added successfully!");
      setDialogOpen(false);
      setFormData({
        invitee_name: "",
        invitee_phone: "",
        invitee_email: "",
        target_service_id: "",
        invitation_method: "",
        notes: "",
      });
      loadData();
    } catch (error: any) {
      console.error("Error adding invitation:", error);
      toast.error("Failed to add invitation");
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const updates: any = { status };
      if (status === "confirmed") updates.confirmed_at = new Date().toISOString();
      if (status === "attended") updates.attended_at = new Date().toISOString();

      const { error } = await supabase
        .from("member_invitations")
        .update(updates)
        .eq("id", id);

      if (error) throw error;

      toast.success("Status updated successfully");
      loadData();
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const filtered = getFilteredInvitations();
    setSelectedIds(prev =>
      prev.length === filtered.length ? [] : filtered.map(i => i.id)
    );
  };

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus) {
      toast.error("Please select a status");
      return;
    }

    try {
      const updates: any = { status: bulkStatus };
      if (bulkStatus === "confirmed") updates.confirmed_at = new Date().toISOString();
      if (bulkStatus === "attended") updates.attended_at = new Date().toISOString();
      if (bulkStatus === "invited") updates.invited_at = new Date().toISOString();

      const { error } = await supabase
        .from("member_invitations")
        .update(updates)
        .in("id", selectedIds);

      if (error) throw error;

      toast.success(`Updated ${selectedIds.length} invitation(s) successfully`);
      setBulkStatusDialogOpen(false);
      setSelectedIds([]);
      setBulkStatus("");
      await loadData();
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending_invite: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
      invited: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
      confirmed: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
      attended: "bg-green-500/10 text-green-700 dark:text-green-400",
      declined: "bg-red-500/10 text-red-700 dark:text-red-400"
    };

    return (
      <Badge className={colors[status] || "bg-gray-500/10 text-gray-700"}>
        {status.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  const getFilteredInvitations = () => {
    if (statusFilter === "all") return invitations;
    return invitations.filter(inv => inv.status === statusFilter);
  };

  const filteredInvitations = getFilteredInvitations();

  const stats = {
    total: invitations.length,
    pending: invitations.filter(i => i.status === "pending_invite").length,
    invited: invitations.filter(i => i.status === "invited").length,
    confirmed: invitations.filter(i => i.status === "confirmed").length,
    attended: invitations.filter(i => i.status === "attended").length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
              <p className="text-xs text-muted-foreground">Pending</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-blue-600">{stats.invited}</div>
              <p className="text-xs text-muted-foreground">Invited</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-purple-600">{stats.confirmed}</div>
              <p className="text-xs text-muted-foreground">Confirmed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">{stats.attended}</div>
              <p className="text-xs text-muted-foreground">Attended</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-6 w-6" />
                  My Invitations
                </CardTitle>
                <CardDescription>
                  Track people you've invited to church services
                </CardDescription>
              </div>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Invitation
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending_invite">Pending Invite</SelectItem>
                  <SelectItem value="invited">Invited</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="attended">Attended</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <BulkActionBar
              selectedCount={selectedIds.length}
              onSelectAll={toggleSelectAll}
              onClearSelection={() => setSelectedIds([])}
              actions={[
                {
                  label: "Update Status",
                  icon: Check,
                  onClick: () => setBulkStatusDialogOpen(true),
                  variant: "default",
                },
              ]}
            />

            <div className="space-y-4">
              {loading ? (
                <p className="text-center text-muted-foreground py-8">Loading...</p>
              ) : filteredInvitations.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No invitations yet</p>
              ) : (
                filteredInvitations.map((invitation) => (
                  <div key={invitation.id} className="border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                    <div className="flex items-start gap-4">
                      <Checkbox
                        checked={selectedIds.includes(invitation.id)}
                        onCheckedChange={() => toggleSelection(invitation.id)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold">{invitation.invitee_name}</h3>
                          {getStatusBadge(invitation.status)}
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3" />
                            {invitation.invitee_phone}
                          </div>
                          {invitation.invitee_email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-3 w-3" />
                              {invitation.invitee_email}
                            </div>
                          )}
                          {invitation.services && (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3" />
                              {invitation.services.name} - {format(new Date(invitation.services.service_date), "PPP")}
                            </div>
                          )}
                          {invitation.notes && (
                            <p className="text-xs mt-2 italic">{invitation.notes}</p>
                          )}
                        </div>
                        <div className="flex gap-2 mt-3 flex-wrap">
                          {invitation.status === "pending_invite" && (
                            <Button size="sm" onClick={() => handleUpdateStatus(invitation.id, "invited")}>
                              Mark as Invited
                            </Button>
                          )}
                          {invitation.status === "invited" && (
                            <Button size="sm" onClick={() => handleUpdateStatus(invitation.id, "confirmed")}>
                              Mark as Confirmed
                            </Button>
                          )}
                          {invitation.status === "confirmed" && (
                            <Button size="sm" onClick={() => handleUpdateStatus(invitation.id, "attended")}>
                              Mark as Attended
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Add Invitation Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Invitation</DialogTitle>
              <DialogDescription>
                Record someone you've invited to a church service
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddInvitation} className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={formData.invitee_name}
                  onChange={(e) => setFormData({ ...formData, invitee_name: e.target.value })}
                  placeholder="Full name"
                  required
                />
              </div>
              <div>
                <Label>Phone *</Label>
                <Input
                  value={formData.invitee_phone}
                  onChange={(e) => setFormData({ ...formData, invitee_phone: e.target.value })}
                  placeholder="+265..."
                  required
                />
              </div>
              <div>
                <Label>Email (Optional)</Label>
                <Input
                  type="email"
                  value={formData.invitee_email}
                  onChange={(e) => setFormData({ ...formData, invitee_email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <Label>Target Service (Optional)</Label>
                <Select value={formData.target_service_id} onValueChange={(val) => setFormData({ ...formData, target_service_id: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name} - {format(new Date(service.service_date), "PPP")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Invitation Method</Label>
                <Select value={formData.invitation_method} onValueChange={(val) => setFormData({ ...formData, invitation_method: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="How did you invite them?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_person">In Person</SelectItem>
                    <SelectItem value="phone_call">Phone Call</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional notes..."
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Invitation</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Bulk Status Update Dialog */}
        <Dialog open={bulkStatusDialogOpen} onOpenChange={setBulkStatusDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Status for {selectedIds.length} Invitation(s)</DialogTitle>
              <DialogDescription>
                Select a new status to apply to all selected invitations
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>New Status</Label>
                <Select value={bulkStatus} onValueChange={setBulkStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending_invite">Pending Invite</SelectItem>
                    <SelectItem value="invited">Invited</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="attended">Attended</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkStatusDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleBulkStatusUpdate} disabled={!bulkStatus}>
                Update Status
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default MemberMobilization;
