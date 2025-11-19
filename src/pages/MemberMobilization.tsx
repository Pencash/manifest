import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Plus, Phone, MessageCircle, Check, UserPlus, Calendar, TrendingUp } from "lucide-react";
import { format } from "date-fns";

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
        .order("service_date", { ascending: true })
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
        status: "pending_invite",
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
      toast.error(error.message || "Failed to add invitation");
    }
  };

  const updateStatus = async (invitationId: string, newStatus: string) => {
    const updateData: any = { status: newStatus };
    
    if (newStatus === "invited") {
      updateData.invited_at = new Date().toISOString();
    } else if (newStatus === "confirmed") {
      updateData.confirmed_at = new Date().toISOString();
    } else if (newStatus === "attended") {
      updateData.attended_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("member_invitations")
      .update(updateData)
      .eq("id", invitationId);

    if (error) {
      toast.error("Failed to update status");
      return;
    }

    toast.success(`Status updated to ${newStatus}!`);
    loadData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending_invite": return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300";
      case "invited": return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
      case "confirmed": return "bg-purple-500/10 text-purple-700 dark:text-purple-300";
      case "attended": return "bg-green-500/10 text-green-700 dark:text-green-300";
      default: return "bg-gray-500/10 text-gray-700 dark:text-gray-300";
    }
  };

  const getStatusLabel = (status: string) => {
    return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const groupedInvitations = {
    pending_invite: invitations.filter(i => i.status === "pending_invite"),
    invited: invitations.filter(i => i.status === "invited"),
    confirmed: invitations.filter(i => i.status === "confirmed"),
    attended: invitations.filter(i => i.status === "attended"),
  };

  const stats = {
    total: invitations.length,
    invited: groupedInvitations.invited.length + groupedInvitations.confirmed.length + groupedInvitations.attended.length,
    confirmed: groupedInvitations.confirmed.length + groupedInvitations.attended.length,
    attended: groupedInvitations.attended.length,
    conversionRate: invitations.length > 0 ? ((groupedInvitations.attended.length / invitations.length) * 100).toFixed(0) : 0,
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
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-foreground">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total Invites</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-foreground">{stats.invited}</div>
              <div className="text-sm text-muted-foreground">Invited</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-indigo-500/10 to-blue-500/10">
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
          <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-foreground">{stats.conversionRate}%</div>
              <div className="text-sm text-muted-foreground">Success Rate</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">My Invitation Tracker 🤝</CardTitle>
                <CardDescription>Track friends you've invited to church events</CardDescription>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add Invitation
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add New Invitation</DialogTitle>
                    <DialogDescription>Track a friend you want to invite</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddInvitation} className="space-y-4">
                    <div>
                      <Label>Friend's Name *</Label>
                      <Input
                        value={formData.invitee_name}
                        onChange={(e) => setFormData({ ...formData, invitee_name: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>Phone Number *</Label>
                      <Input
                        value={formData.invitee_phone}
                        onChange={(e) => setFormData({ ...formData, invitee_phone: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label>Email (Optional)</Label>
                      <Input
                        type="email"
                        value={formData.invitee_email}
                        onChange={(e) => setFormData({ ...formData, invitee_email: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Target Event</Label>
                      <Select value={formData.target_service_id} onValueChange={(value) => setFormData({ ...formData, target_service_id: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an event" />
                        </SelectTrigger>
                        <SelectContent>
                          {services.map((service) => (
                            <SelectItem key={service.id} value={service.id}>
                              {service.name} - {format(new Date(service.service_date), "MMM d, yyyy")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>How will you invite them?</Label>
                      <Select value={formData.invitation_method} onValueChange={(value) => setFormData({ ...formData, invitation_method: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                          <SelectItem value="call">Phone Call</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="in_person">In Person</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Notes (Optional)</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={2}
                      />
                    </div>
                    <Button type="submit" className="w-full">Add Invitation</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Pending Invites */}
            {groupedInvitations.pending_invite.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-yellow-500" />
                  Pending Invites ({groupedInvitations.pending_invite.length})
                </h3>
                <div className="space-y-2">
                  {groupedInvitations.pending_invite.map((inv) => (
                    <Card key={inv.id} className="bg-gradient-to-r from-yellow-500/5 to-transparent">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold">{inv.invitee_name}</p>
                            <p className="text-sm text-muted-foreground">{inv.invitee_phone}</p>
                            {inv.services && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Target: {inv.services.name} - {format(new Date(inv.services.service_date), "MMM d")}
                              </p>
                            )}
                          </div>
                          <Button size="sm" onClick={() => updateStatus(inv.id, "invited")}>
                            Mark as Invited
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Invited */}
            {groupedInvitations.invited.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-blue-500" />
                  Invited ({groupedInvitations.invited.length})
                </h3>
                <div className="space-y-2">
                  {groupedInvitations.invited.map((inv) => (
                    <Card key={inv.id} className="bg-gradient-to-r from-blue-500/5 to-transparent">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold">{inv.invitee_name}</p>
                            <p className="text-sm text-muted-foreground">{inv.invitee_phone}</p>
                            {inv.invited_at && (
                              <p className="text-xs text-muted-foreground">
                                Invited {format(new Date(inv.invited_at), "MMM d")}
                              </p>
                            )}
                          </div>
                          <Button size="sm" onClick={() => updateStatus(inv.id, "confirmed")} variant="outline">
                            Mark as Confirmed
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Confirmed */}
            {groupedInvitations.confirmed.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Check className="w-5 h-5 text-purple-500" />
                  Confirmed ({groupedInvitations.confirmed.length})
                </h3>
                <div className="space-y-2">
                  {groupedInvitations.confirmed.map((inv) => (
                    <Card key={inv.id} className="bg-gradient-to-r from-purple-500/5 to-transparent">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold">{inv.invitee_name}</p>
                            <p className="text-sm text-muted-foreground">{inv.invitee_phone}</p>
                            {inv.confirmed_at && (
                              <p className="text-xs text-muted-foreground">
                                Confirmed {format(new Date(inv.confirmed_at), "MMM d")}
                              </p>
                            )}
                          </div>
                          <Button size="sm" onClick={() => updateStatus(inv.id, "attended")} variant="outline">
                            Mark as Attended
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Attended */}
            {groupedInvitations.attended.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  Attended - Success! 🎉 ({groupedInvitations.attended.length})
                </h3>
                <div className="space-y-2">
                  {groupedInvitations.attended.map((inv) => (
                    <Card key={inv.id} className="bg-gradient-to-r from-green-500/5 to-transparent">
                      <CardContent className="p-4">
                        <div className="flex-1">
                          <p className="font-semibold">{inv.invitee_name}</p>
                          <p className="text-sm text-muted-foreground">{inv.invitee_phone}</p>
                          {inv.attended_at && (
                            <p className="text-xs text-muted-foreground">
                              Attended {format(new Date(inv.attended_at), "MMM d")}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {invitations.length === 0 && (
              <div className="text-center py-12">
                <UserPlus className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground mb-4">No invitations yet. Start inviting friends!</p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Invitation
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MemberMobilization;