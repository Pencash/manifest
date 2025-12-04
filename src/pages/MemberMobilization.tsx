import { useEffect, useState, useCallback } from "react";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Plus, Phone, Check, UserPlus, Calendar, Mail, Trash2, X, Loader2, MapPin, Clock, Target } from "lucide-react";
import { format } from "date-fns";
import { BulkActionBar } from "@/components/BulkActionBar";
import { Skeleton } from "@/components/ui/skeleton";

interface Invitation {
  id: string;
  invitee_name: string;
  invitee_phone: string | null;
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
  const [servicesLoaded, setServicesLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
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
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [myServices, setMyServices] = useState<{id: string; name: string; date: string}[]>([]);
  const [invitationsPerService, setInvitationsPerService] = useState<Map<string, { total: number; confirmed: number; attended: number }>>(new Map());

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

  const loadServices = useCallback(async () => {
    if (servicesLoaded) return;
    
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("is_published", true)
      .gte("service_date", new Date().toISOString().split('T')[0])
      .order("service_date", { ascending: true })
      .limit(20);
    
    if (data) {
      setServices(data);
      setServicesLoaded(true);
    }
  }, [servicesLoaded]);

  const loadInvitations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("member_invitations")
      .select("*, services(name, service_date)")
      .eq("member_id", user.id)
      .order("created_at", { ascending: false });

    if (data) {
      setInvitations(data);
      
      // Extract unique services from invitations for filter dropdown
      const serviceMap = new Map<string, {id: string; name: string; date: string}>();
      // Calculate invitations per service
      const perServiceStats = new Map<string, { total: number; confirmed: number; attended: number }>();
      
      data.forEach((inv: any) => {
        if (inv.target_service_id && inv.services) {
          serviceMap.set(inv.target_service_id, {
            id: inv.target_service_id,
            name: inv.services.name,
            date: inv.services.service_date
          });
          
          // Update per-service stats
          const current = perServiceStats.get(inv.target_service_id) || { total: 0, confirmed: 0, attended: 0 };
          current.total++;
          if (inv.status === 'confirmed') current.confirmed++;
          if (inv.status === 'attended') current.attended++;
          perServiceStats.set(inv.target_service_id, current);
        }
      });
      
      setInvitationsPerService(perServiceStats);
      
      // Sort by date descending
      const sortedServices = Array.from(serviceMap.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      setMyServices(sortedServices);
    }
  };

  const loadData = async () => {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await Promise.all([loadInvitations(), loadServices()]);
    setLoading(false);
  };

  const checkDuplicateInvitation = async (name: string, serviceId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data } = await supabase
      .from("member_invitations")
      .select("id")
      .eq("member_id", user.id)
      .eq("invitee_name", name)
      .eq("target_service_id", serviceId)
      .limit(1);

    return data && data.length > 0;
  };

  const handleAddInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return; // Guard against double submission
    
    // Validation: Name and target service are required
    if (!formData.invitee_name.trim()) {
      toast.error("Name is required");
      return;
    }
    
    if (!formData.target_service_id) {
      toast.error("Please select a target service/event");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check for duplicate
      const isDuplicate = await checkDuplicateInvitation(
        formData.invitee_name.trim(), 
        formData.target_service_id
      );
      
      if (isDuplicate) {
        toast.warning("You've already invited someone with this name to this event", {
          description: "Are you sure you want to add another invitation?",
          action: {
            label: "Add anyway",
            onClick: async () => {
              await insertInvitation(user.id);
            }
          }
        });
        setIsSubmitting(false);
        return;
      }

      await insertInvitation(user.id);
    } catch (error: any) {
      console.error("Error adding invitation:", error);
      toast.error("Failed to add invitation");
      setIsSubmitting(false);
    }
  };

  const insertInvitation = async (userId: string) => {
    try {
      const { error } = await supabase.from("member_invitations").insert({
        member_id: userId,
        invitee_name: formData.invitee_name.trim(),
        invitee_phone: formData.invitee_phone.trim() || null,
        invitee_email: formData.invitee_email.trim() || null,
        target_service_id: formData.target_service_id,
        invitation_method: formData.invitation_method || null,
        notes: formData.notes.trim() || null,
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
      await loadInvitations();
    } catch (error: any) {
      console.error("Error inserting invitation:", error);
      toast.error("Failed to add invitation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    if (updatingStatusId) return; // Prevent double clicks
    
    setUpdatingStatusId(id);
    
    // Optimistic update
    const previousInvitations = [...invitations];
    setInvitations(prev => 
      prev.map(inv => inv.id === id ? { ...inv, status } : inv)
    );

    try {
      const updates: any = { status };
      if (status === "invited") updates.invited_at = new Date().toISOString();
      if (status === "confirmed") updates.confirmed_at = new Date().toISOString();
      if (status === "attended") updates.attended_at = new Date().toISOString();

      const { error } = await supabase
        .from("member_invitations")
        .update(updates)
        .eq("id", id);

      if (error) throw error;

      toast.success("Status updated");
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
      // Revert optimistic update
      setInvitations(previousInvitations);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleDeleteInvitation = async () => {
    if (!deleteConfirmId || isDeleting) return;
    
    setIsDeleting(true);
    const invitationToDelete = invitations.find(i => i.id === deleteConfirmId);
    
    // Optimistic update
    setInvitations(prev => prev.filter(i => i.id !== deleteConfirmId));
    setDeleteConfirmId(null);

    try {
      const { error } = await supabase
        .from("member_invitations")
        .delete()
        .eq("id", deleteConfirmId);

      if (error) throw error;

      toast.success("Invitation deleted", {
        action: {
          label: "Undo",
          onClick: async () => {
            if (invitationToDelete) {
              // Re-insert the deleted invitation
              await supabase.from("member_invitations").insert({
                id: invitationToDelete.id,
                member_id: (await supabase.auth.getUser()).data.user?.id,
                invitee_name: invitationToDelete.invitee_name,
                invitee_phone: invitationToDelete.invitee_phone,
                invitee_email: invitationToDelete.invitee_email,
                target_service_id: invitationToDelete.target_service_id,
                invitation_method: invitationToDelete.invitation_method,
                notes: invitationToDelete.notes,
                status: invitationToDelete.status,
              });
              await loadInvitations();
              toast.success("Invitation restored");
            }
          }
        }
      });
    } catch (error: any) {
      console.error("Error deleting invitation:", error);
      toast.error("Failed to delete invitation");
      await loadInvitations(); // Reload to restore state
    } finally {
      setIsDeleting(false);
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
    if (!bulkStatus || isBulkUpdating) {
      if (!bulkStatus) toast.error("Please select a status");
      return;
    }

    setIsBulkUpdating(true);

    try {
      const updates: any = { status: bulkStatus };
      if (bulkStatus === "invited") updates.invited_at = new Date().toISOString();
      if (bulkStatus === "confirmed") updates.confirmed_at = new Date().toISOString();
      if (bulkStatus === "attended") updates.attended_at = new Date().toISOString();

      const { error } = await supabase
        .from("member_invitations")
        .update(updates)
        .in("id", selectedIds);

      if (error) throw error;

      toast.success(`Updated ${selectedIds.length} invitation(s)`);
      setBulkStatusDialogOpen(false);
      setSelectedIds([]);
      setBulkStatus("");
      await loadInvitations();
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0 || isBulkUpdating) return;
    
    setIsBulkUpdating(true);
    const count = selectedIds.length;

    try {
      const { error } = await supabase
        .from("member_invitations")
        .delete()
        .in("id", selectedIds);

      if (error) throw error;

      toast.success(`Deleted ${count} invitation(s)`);
      setSelectedIds([]);
      await loadInvitations();
    } catch (error: any) {
      console.error("Error deleting invitations:", error);
      toast.error("Failed to delete invitations");
    } finally {
      setIsBulkUpdating(false);
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
    let filtered = invitations;
    if (eventFilter !== "all") {
      filtered = filtered.filter(inv => inv.target_service_id === eventFilter);
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter(inv => inv.status === statusFilter);
    }
    return filtered;
  };

  const filteredInvitations = getFilteredInvitations();

  // Stats based on event filter (not status filter)
  const statsBase = eventFilter === "all" 
    ? invitations 
    : invitations.filter(inv => inv.target_service_id === eventFilter);

  const stats = {
    total: statsBase.length,
    pending: statsBase.filter(i => i.status === "pending_invite").length,
    invited: statsBase.filter(i => i.status === "invited").length,
    confirmed: statsBase.filter(i => i.status === "confirmed").length,
    attended: statsBase.filter(i => i.status === "attended").length,
    declined: statsBase.filter(i => i.status === "declined").length,
    conversionRate: statsBase.length > 0 
      ? Math.round((statsBase.filter(i => i.status === "attended").length / statsBase.length) * 100)
      : 0,
  };

  // Get selected event name for display
  const selectedEventName = eventFilter !== "all" 
    ? myServices.find(s => s.id === eventFilter)?.name 
    : null;

  const openInvitationDialog = (preSelectedServiceId?: string) => {
    if (preSelectedServiceId) {
      setFormData(prev => ({ ...prev, target_service_id: preSelectedServiceId }));
    }
    setDialogOpen(true);
  };

  const getServiceTypeBadge = (serviceType: string | null) => {
    const typeLabels: Record<string, string> = {
      sunday_service: "Sunday Service",
      tuesday_fellowship: "Tuesday Fellowship",
      thursday_livestream: "Thursday Livestream",
      ltc: "LTC",
      gic: "GIC",
      nop: "Night of Prayer",
      men_gather: "Men Gather",
      mgp: "MGP",
      other: "Special Event"
    };
    return typeLabels[serviceType || 'other'] || "Event";
  };

  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="border rounded-lg p-4">
          <div className="flex items-start gap-4">
            <Skeleton className="h-5 w-5 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-40" />
              <div className="flex gap-2 mt-3">
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const EmptyState = () => (
    <div className="text-center py-12">
      <UserPlus className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
      <h3 className="text-lg font-semibold mb-2">No invitations yet</h3>
      <p className="text-muted-foreground mb-4">
        Start tracking people you've invited to church services
      </p>
      <Button onClick={() => openInvitationDialog()}>
        <Plus className="mr-2 h-4 w-4" />
        Add Your First Invitation
      </Button>
    </div>
  );

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

        {/* Upcoming Events Section */}
        {services.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Upcoming Events
              </CardTitle>
              <CardDescription>
                Choose an event to invite people to
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {services.slice(0, 6).map((service) => {
                  const serviceStats = invitationsPerService.get(service.id) || { total: 0, confirmed: 0, attended: 0 };
                  const isUpcoming = new Date(service.service_date) > new Date();
                  const isSoon = new Date(service.service_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                  
                  return (
                    <div 
                      key={service.id}
                      className={`relative border rounded-lg p-4 transition-all hover:shadow-md ${
                        isSoon ? 'border-primary/50 bg-primary/5' : 'hover:border-primary/30'
                      }`}
                    >
                      {isSoon && (
                        <Badge className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs">
                          Soon
                        </Badge>
                      )}
                      
                      <div className="space-y-3">
                        <div>
                          <h3 className="font-semibold text-base line-clamp-1">{service.name}</h3>
                          <Badge variant="outline" className="mt-1 text-xs">
                            {getServiceTypeBadge(service.service_type)}
                          </Badge>
                        </div>
                        
                        <div className="space-y-1.5 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>{format(new Date(service.service_date), "EEE, MMM d, yyyy")}</span>
                          </div>
                          {service.start_time && (
                            <div className="flex items-center gap-2">
                              <Clock className="h-3.5 w-3.5" />
                              <span>{service.start_time}</span>
                            </div>
                          )}
                          {service.location && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5" />
                              <span className="line-clamp-1">{service.location}</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex items-center gap-1 text-sm">
                            <Target className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-medium">{serviceStats.total}</span>
                            <span className="text-muted-foreground">invited</span>
                            {serviceStats.confirmed > 0 && (
                              <span className="text-green-600 ml-1">({serviceStats.confirmed} confirmed)</span>
                            )}
                          </div>
                        </div>
                        
                        <Button 
                          className="w-full" 
                          size="sm"
                          onClick={() => openInvitationDialog(service.id)}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Invite Here
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {services.length > 6 && (
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Showing 6 of {services.length} upcoming events
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Event Filter Header */}
        {selectedEventName && (
          <div className="mb-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
            <p className="text-sm font-medium">
              Showing stats for: <span className="text-primary">{selectedEventName}</span>
            </p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
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
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-600">{stats.declined}</div>
              <p className="text-xs text-muted-foreground">Declined</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-primary">{stats.conversionRate}%</div>
              <p className="text-xs text-muted-foreground">Conversion Rate</p>
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
              <Button onClick={() => openInvitationDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Invitation
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 mb-4">
              <Select value={eventFilter} onValueChange={setEventFilter}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Filter by Event" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  {myServices.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} ({format(new Date(service.date), "MMM d, yyyy")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                {
                  label: "Delete Selected",
                  icon: Trash2,
                  onClick: handleBulkDelete,
                  variant: "destructive",
                },
              ]}
            />

            <div className="space-y-4">
              {loading ? (
                <LoadingSkeleton />
              ) : invitations.length === 0 ? (
                <EmptyState />
              ) : filteredInvitations.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No invitations match the selected filter
                </p>
              ) : (
                filteredInvitations.map((invitation) => (
                  <div 
                    key={invitation.id} 
                    className={`border rounded-lg p-4 hover:bg-accent/50 transition-colors ${
                      updatingStatusId === invitation.id ? 'opacity-70' : ''
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <Checkbox
                        checked={selectedIds.includes(invitation.id)}
                        onCheckedChange={() => toggleSelection(invitation.id)}
                        disabled={updatingStatusId === invitation.id}
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold">{invitation.invitee_name}</h3>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(invitation.status)}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteConfirmId(invitation.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          {invitation.invitee_phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-3 w-3" />
                              {invitation.invitee_phone}
                            </div>
                          )}
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
                            <Button 
                              size="sm" 
                              onClick={() => handleUpdateStatus(invitation.id, "invited")}
                              disabled={updatingStatusId === invitation.id}
                            >
                              {updatingStatusId === invitation.id ? (
                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                              ) : null}
                              Mark as Invited
                            </Button>
                          )}
                          {invitation.status === "invited" && (
                            <>
                              <Button 
                                size="sm" 
                                onClick={() => handleUpdateStatus(invitation.id, "confirmed")}
                                disabled={updatingStatusId === invitation.id}
                              >
                                {updatingStatusId === invitation.id ? (
                                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                ) : null}
                                Mark as Confirmed
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950"
                                onClick={() => handleUpdateStatus(invitation.id, "declined")}
                                disabled={updatingStatusId === invitation.id}
                              >
                                <X className="mr-1 h-3 w-3" />
                                Declined
                              </Button>
                            </>
                          )}
                          {invitation.status === "confirmed" && (
                            <>
                              <Button 
                                size="sm" 
                                onClick={() => handleUpdateStatus(invitation.id, "attended")}
                                disabled={updatingStatusId === invitation.id}
                              >
                                {updatingStatusId === invitation.id ? (
                                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                ) : null}
                                Mark as Attended
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950"
                                onClick={() => handleUpdateStatus(invitation.id, "declined")}
                                disabled={updatingStatusId === invitation.id}
                              >
                                <X className="mr-1 h-3 w-3" />
                                Declined
                              </Button>
                            </>
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
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          if (!isSubmitting) setDialogOpen(open);
        }}>
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
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <Label>Target Service/Event *</Label>
                <Select 
                  value={formData.target_service_id} 
                  onValueChange={(val) => setFormData({ ...formData, target_service_id: val })}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className={!formData.target_service_id ? "text-muted-foreground" : ""}>
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
                <p className="text-xs text-muted-foreground mt-1">Required - select the event they're invited to</p>
              </div>
              <div>
                <Label>Phone (Optional)</Label>
                <Input
                  value={formData.invitee_phone}
                  onChange={(e) => setFormData({ ...formData, invitee_phone: e.target.value })}
                  placeholder="+265..."
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <Label>Email (Optional)</Label>
                <Input
                  type="email"
                  value={formData.invitee_email}
                  onChange={(e) => setFormData({ ...formData, invitee_email: e.target.value })}
                  placeholder="email@example.com"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <Label>Invitation Method</Label>
                <Select 
                  value={formData.invitation_method} 
                  onValueChange={(val) => setFormData({ ...formData, invitation_method: val })}
                  disabled={isSubmitting}
                >
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
                  disabled={isSubmitting}
                />
              </div>
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Invitation"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Bulk Status Update Dialog */}
        <Dialog open={bulkStatusDialogOpen} onOpenChange={(open) => {
          if (!isBulkUpdating) setBulkStatusDialogOpen(open);
        }}>
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
                <Select value={bulkStatus} onValueChange={setBulkStatus} disabled={isBulkUpdating}>
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
              <Button variant="outline" onClick={() => setBulkStatusDialogOpen(false)} disabled={isBulkUpdating}>
                Cancel
              </Button>
              <Button onClick={handleBulkStatusUpdate} disabled={!bulkStatus || isBulkUpdating}>
                {isBulkUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Status"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Invitation?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this invitation? This action can be undone briefly after deletion.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteInvitation}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default MemberMobilization;