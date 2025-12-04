import { useState, useMemo } from "react";
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
import { useAuth } from "@/contexts/AuthContext";
import { 
  useUpcomingServices, 
  useInvitations, 
  useAddInvitation, 
  useUpdateInvitationStatus, 
  useDeleteInvitation,
  useBulkUpdateStatus,
  useBulkDelete
} from "@/hooks/useMobilizationData";

const MemberMobilization = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // React Query hooks
  const { data: services = [], isLoading: servicesLoading } = useUpcomingServices();
  const { data: invitations = [], isLoading: invitationsLoading } = useInvitations(user?.id);
  const addInvitationMutation = useAddInvitation();
  const updateStatusMutation = useUpdateInvitationStatus();
  const deleteInvitationMutation = useDeleteInvitation();
  const bulkUpdateMutation = useBulkUpdateStatus();
  const bulkDeleteMutation = useBulkDelete();
  
  const loading = servicesLoading || invitationsLoading;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
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
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [upcomingEventTypeFilter, setUpcomingEventTypeFilter] = useState<string>("all");
  const [selectedUpcomingEvent, setSelectedUpcomingEvent] = useState<string>("");

  // Computed values
  const { myServices, invitationsPerService } = useMemo(() => {
    const serviceMap = new Map<string, {id: string; name: string; date: string}>();
    const perServiceStats = new Map<string, { total: number; confirmed: number; attended: number }>();
    
    invitations.forEach((inv: any) => {
      if (inv.target_service_id && inv.services) {
        serviceMap.set(inv.target_service_id, {
          id: inv.target_service_id,
          name: inv.services.name,
          date: inv.services.service_date
        });
        
        const current = perServiceStats.get(inv.target_service_id) || { total: 0, confirmed: 0, attended: 0 };
        current.total++;
        if (inv.status === 'confirmed') current.confirmed++;
        if (inv.status === 'attended') current.attended++;
        perServiceStats.set(inv.target_service_id, current);
      }
    });
    
    const sortedServices = Array.from(serviceMap.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    return { myServices: sortedServices, invitationsPerService: perServiceStats };
  }, [invitations]);

  const checkDuplicateInvitation = async (name: string, serviceId: string) => {
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
    
    if (addInvitationMutation.isPending) return;
    
    if (!formData.invitee_name.trim()) {
      toast.error("Name is required");
      return;
    }
    
    if (!formData.target_service_id) {
      toast.error("Please select a target service/event");
      return;
    }

    if (!user) {
      toast.error("Not authenticated");
      return;
    }

    const isDuplicate = await checkDuplicateInvitation(
      formData.invitee_name.trim(), 
      formData.target_service_id
    );
    
    if (isDuplicate) {
      toast.warning("You've already invited someone with this name to this event", {
        description: "Are you sure you want to add another invitation?",
        action: {
          label: "Add anyway",
          onClick: () => insertInvitation()
        }
      });
      return;
    }

    await insertInvitation();
  };

  const insertInvitation = async () => {
    if (!user) return;
    
    try {
      await addInvitationMutation.mutateAsync({
        userId: user.id,
        invitee_name: formData.invitee_name.trim(),
        invitee_phone: formData.invitee_phone.trim() || null,
        invitee_email: formData.invitee_email.trim() || null,
        target_service_id: formData.target_service_id,
        invitation_method: formData.invitation_method || null,
        notes: formData.notes.trim() || null,
      });

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
    } catch (error: any) {
      console.error("Error adding invitation:", error);
      toast.error("Failed to add invitation");
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    if (!user || updateStatusMutation.isPending) return;

    try {
      await updateStatusMutation.mutateAsync({ id, status, userId: user.id });
      toast.success("Status updated");
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const handleDeleteInvitation = async () => {
    if (!deleteConfirmId || !user || deleteInvitationMutation.isPending) return;
    
    const invitationToDelete = invitations.find(i => i.id === deleteConfirmId);
    const idToDelete = deleteConfirmId;
    setDeleteConfirmId(null);

    try {
      await deleteInvitationMutation.mutateAsync({ id: idToDelete, userId: user.id });

      toast.success("Invitation deleted", {
        action: {
          label: "Undo",
          onClick: async () => {
            if (invitationToDelete) {
              await supabase.from("member_invitations").insert({
                id: invitationToDelete.id,
                member_id: user.id,
                invitee_name: invitationToDelete.invitee_name,
                invitee_phone: invitationToDelete.invitee_phone,
                invitee_email: invitationToDelete.invitee_email,
                target_service_id: invitationToDelete.target_service_id,
                invitation_method: invitationToDelete.invitation_method,
                notes: invitationToDelete.notes,
                status: invitationToDelete.status,
              });
              toast.success("Invitation restored");
            }
          }
        }
      });
    } catch (error: any) {
      console.error("Error deleting invitation:", error);
      toast.error("Failed to delete invitation");
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
    if (!bulkStatus || !user || bulkUpdateMutation.isPending) {
      if (!bulkStatus) toast.error("Please select a status");
      return;
    }

    try {
      await bulkUpdateMutation.mutateAsync({ ids: selectedIds, status: bulkStatus, userId: user.id });
      toast.success(`Updated ${selectedIds.length} invitation(s)`);
      setBulkStatusDialogOpen(false);
      setSelectedIds([]);
      setBulkStatus("");
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0 || !user || bulkDeleteMutation.isPending) return;
    
    const count = selectedIds.length;

    try {
      await bulkDeleteMutation.mutateAsync({ ids: selectedIds, userId: user.id });
      toast.success(`Deleted ${count} invitation(s)`);
      setSelectedIds([]);
    } catch (error: any) {
      console.error("Error deleting invitations:", error);
      toast.error("Failed to delete invitations");
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

  // Skeleton Components
  const QuickInviteSkeleton = () => (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="h-4 w-40 mt-1" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Skeleton className="h-10 w-full sm:w-[180px]" />
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-full sm:w-[120px]" />
        </div>
      </CardContent>
    </Card>
  );

  const StatsSkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <Card key={i}>
          <CardContent className="pt-6">
            <Skeleton className="h-8 w-12 mb-1" />
            <Skeleton className="h-3 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const InvitationListSkeleton = () => (
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

        {/* Quick Invite Section */}
        {servicesLoading ? (
          <QuickInviteSkeleton />
        ) : services.length > 0 && (() => {
          const eventTypes = Array.from(new Set(services.map(s => s.service_type).filter(Boolean)));
          
          const filteredServices = upcomingEventTypeFilter === "all" 
            ? services 
            : services.filter(s => s.service_type === upcomingEventTypeFilter);
          
          const selectedService = selectedUpcomingEvent 
            ? services.find(s => s.id === selectedUpcomingEvent) 
            : null;
          const selectedStats = selectedService 
            ? invitationsPerService.get(selectedService.id) || { total: 0, confirmed: 0, attended: 0 }
            : null;
          const isSoon = selectedService 
            ? new Date(selectedService.service_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            : false;

          return (
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="h-5 w-5" />
                  Quick Invite
                </CardTitle>
                <CardDescription>
                  Select an event and start inviting
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Select value={upcomingEventTypeFilter} onValueChange={(val) => {
                    setUpcomingEventTypeFilter(val);
                    setSelectedUpcomingEvent("");
                  }}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Event Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {eventTypes.map((type) => (
                        <SelectItem key={type} value={type || "other"}>
                          {getServiceTypeBadge(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={selectedUpcomingEvent} onValueChange={setSelectedUpcomingEvent}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select an event..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredServices.map((service) => {
                        const stats = invitationsPerService.get(service.id) || { total: 0, confirmed: 0, attended: 0 };
                        return (
                          <SelectItem key={service.id} value={service.id}>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{service.name}</span>
                              <span className="text-muted-foreground">
                                ({format(new Date(service.service_date), "MMM d")})
                              </span>
                              {stats.total > 0 && (
                                <Badge variant="secondary" className="text-xs ml-1">
                                  {stats.total} invited
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  
                  <Button 
                    onClick={() => selectedUpcomingEvent && openInvitationDialog(selectedUpcomingEvent)}
                    disabled={!selectedUpcomingEvent}
                    className="w-full sm:w-auto"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Invite Here
                  </Button>
                </div>
                
                {selectedService && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 bg-muted/50 rounded-lg border text-sm">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{format(new Date(selectedService.service_date), "EEEE, MMM d, yyyy")}</span>
                      {isSoon && (
                        <Badge className="bg-primary text-primary-foreground text-xs ml-1">Soon</Badge>
                      )}
                    </div>
                    {selectedService.start_time && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedService.start_time}</span>
                      </div>
                    )}
                    {selectedService.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedService.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 ml-auto">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{selectedStats?.total || 0}</span>
                      <span className="text-muted-foreground">invited</span>
                      {selectedStats && selectedStats.confirmed > 0 && (
                        <span className="text-green-600">• {selectedStats.confirmed} confirmed</span>
                      )}
                    </div>
                  </div>
                )}
                
                {!selectedUpcomingEvent && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Select an event above to see details and start inviting
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {selectedEventName && (
          <div className="mb-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
            <p className="text-sm font-medium">
              Showing stats for: <span className="text-primary">{selectedEventName}</span>
            </p>
          </div>
        )}

        {/* Stats Cards */}
        {invitationsLoading ? (
          <StatsSkeleton />
        ) : (
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
        )}

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
                <InvitationListSkeleton />
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
                      updateStatusMutation.isPending && updateStatusMutation.variables?.id === invitation.id ? 'opacity-70' : ''
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <Checkbox
                        checked={selectedIds.includes(invitation.id)}
                        onCheckedChange={() => toggleSelection(invitation.id)}
                        disabled={updateStatusMutation.isPending && updateStatusMutation.variables?.id === invitation.id}
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
                              disabled={updateStatusMutation.isPending}
                            >
                              {updateStatusMutation.isPending && updateStatusMutation.variables?.id === invitation.id ? (
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
                                disabled={updateStatusMutation.isPending}
                              >
                                {updateStatusMutation.isPending && updateStatusMutation.variables?.id === invitation.id ? (
                                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                ) : null}
                                Mark as Confirmed
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950"
                                onClick={() => handleUpdateStatus(invitation.id, "declined")}
                                disabled={updateStatusMutation.isPending}
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
                                variant="default"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleUpdateStatus(invitation.id, "attended")}
                                disabled={updateStatusMutation.isPending}
                              >
                                {updateStatusMutation.isPending && updateStatusMutation.variables?.id === invitation.id ? (
                                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                ) : null}
                                <Check className="mr-1 h-3 w-3" />
                                Mark Attended
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950"
                                onClick={() => handleUpdateStatus(invitation.id, "declined")}
                                disabled={updateStatusMutation.isPending}
                              >
                                <X className="mr-1 h-3 w-3" />
                                No Show
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
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Invitation</DialogTitle>
              <DialogDescription>
                Track someone you're inviting to church
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddInvitation}>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.invitee_name}
                    onChange={(e) => setFormData({ ...formData, invitee_name: e.target.value })}
                    placeholder="Person's name"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.invitee_phone}
                    onChange={(e) => setFormData({ ...formData, invitee_phone: e.target.value })}
                    placeholder="Phone number"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.invitee_email}
                    onChange={(e) => setFormData({ ...formData, invitee_email: e.target.value })}
                    placeholder="Email address"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="service">Target Service/Event *</Label>
                  <Select
                    value={formData.target_service_id}
                    onValueChange={(value) => setFormData({ ...formData, target_service_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select service/event" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name} ({format(new Date(service.service_date), "MMM d, yyyy")})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="method">Invitation Method</Label>
                  <Select
                    value={formData.invitation_method}
                    onValueChange={(value) => setFormData({ ...formData, invitation_method: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="How did you invite?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_person">In Person</SelectItem>
                      <SelectItem value="phone_call">Phone Call</SelectItem>
                      <SelectItem value="text_message">Text Message</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="social_media">Social Media</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Any additional notes..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addInvitationMutation.isPending}>
                  {addInvitationMutation.isPending ? (
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
        <Dialog open={bulkStatusDialogOpen} onOpenChange={setBulkStatusDialogOpen}>
          <DialogContent className="sm:max-w-[350px]">
            <DialogHeader>
              <DialogTitle>Update Status</DialogTitle>
              <DialogDescription>
                Change status for {selectedIds.length} selected invitation(s)
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new status" />
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkStatusDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleBulkStatusUpdate} disabled={bulkUpdateMutation.isPending}>
                {bulkUpdateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Invitation</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this invitation? This action can be undone briefly after deletion.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDeleteInvitation}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default MemberMobilization;
