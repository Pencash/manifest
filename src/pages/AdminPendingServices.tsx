import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { hasAdminAccess } from "@/lib/roles";
import { triggerNotificationRefresh } from "@/lib/notification-events";
import { format } from "date-fns";
import { Calendar, Clock, MapPin, User, CheckCircle, XCircle, Edit } from "lucide-react";

interface PendingService {
  id: string;
  name: string;
  service_type: string;
  service_date: string;
  start_time: string | null;
  location: string | null;
  description: string | null;
  approval_status: string;
  created_by: string;
  created_at: string;
  creator?: {
    full_name: string;
    email: string | null;
  };
}

export default function AdminPendingServices() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [services, setServices] = useState<PendingService[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("pending_admin_approval");
  const [editingService, setEditingService] = useState<PendingService | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    service_date: "",
    start_time: "",
    location: "",
    description: "",
  });

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadServices();
    }
  }, [filter, loading]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/admin/auth");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roleData || !hasAdminAccess(roleData.role)) {
      navigate("/dashboard");
      return;
    }

    setLoading(false);
  };

  const loadServices = async () => {
    const query = supabase
      .from("services")
      .select(`
        *,
        creator:profiles!created_by(full_name, email)
      `)
      .order("created_at", { ascending: false });

    if (filter !== "all") {
      query.eq("approval_status", filter);
    }

    const { data, error } = await query;

    if (error) {
      toast({ title: "Error loading services", description: error.message, variant: "destructive" });
      return;
    }

    setServices(data || []);
  };

  const handleApprove = async (serviceId: string) => {
    const { error } = await supabase
      .from("services")
      .update({
        approval_status: "approved",
        is_published: true,
      })
      .eq("id", serviceId);

    if (error) {
      toast({ title: "Error approving service", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Service approved", description: "The service event is now published" });
    loadServices();
    triggerNotificationRefresh();
  };

  const handleReject = async (serviceId: string) => {
    const { error } = await supabase
      .from("services")
      .update({
        approval_status: "rejected",
        is_published: false,
      })
      .eq("id", serviceId);

    if (error) {
      toast({ title: "Error rejecting service", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Service rejected", description: "The service event has been rejected" });
    loadServices();
    triggerNotificationRefresh();
  };

  const openEditDialog = (service: PendingService) => {
    setEditingService(service);
    setEditForm({
      name: service.name,
      service_date: service.service_date,
      start_time: service.start_time || "",
      location: service.location || "",
      description: service.description || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingService) return;

    const { error } = await supabase
      .from("services")
      .update({
        name: editForm.name,
        service_date: editForm.service_date,
        start_time: editForm.start_time || null,
        location: editForm.location || null,
        description: editForm.description || null,
      })
      .eq("id", editingService.id);

    if (error) {
      toast({ title: "Error updating service", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Service updated", description: "Changes have been saved" });
    setEditingService(null);
    loadServices();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_admin_approval":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Pending</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">Approved</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">Rejected</Badge>;
      default:
        return null;
    }
  };

  const serviceTypeLabels: Record<string, string> = {
    sunday_service: "Sunday Service",
    nop: "NOP (Night of Power)",
    gic: "GIC (Generation in Christ)",
    ltc: "LTC (Love Thy Children)",
    tuesday_fellowship: "Tuesday Fellowship",
    thursday_livestream: "Thursday Livestream",
    mgp: "MGP (My Great Price)",
    men_gather: "Men's Gathering",
    other: "Other Events",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pending Service Events</h1>
        <p className="text-muted-foreground">Review and approve member-submitted service events</p>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="pending_admin_approval">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="space-y-4 mt-6">
          {services.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">No services found for this filter</p>
              </CardContent>
            </Card>
          ) : (
            services.map((service) => (
              <Card key={service.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        {service.name}
                        {getStatusBadge(service.approval_status)}
                      </CardTitle>
                      <Badge variant="secondary">{serviceTypeLabels[service.service_type] || service.service_type}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>{format(new Date(service.service_date), "EEEE, MMMM d, yyyy")}</span>
                    </div>
                    {service.start_time && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>{service.start_time}</span>
                      </div>
                    )}
                    {service.location && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span>{service.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="w-4 h-4" />
                      <span>
                        Created by: {service.creator?.[0]?.full_name || "Unknown"}
                        {service.creator?.[0]?.email && ` (${service.creator[0].email})`}
                      </span>
                    </div>
                  </div>
                  {service.description && (
                    <div className="text-sm text-muted-foreground border-t pt-4">
                      <p className="font-medium text-foreground mb-1">Description:</p>
                      <p>{service.description}</p>
                    </div>
                  )}
                  {service.approval_status === "pending_admin_approval" && (
                    <div className="flex gap-2 pt-2">
                      <Button onClick={() => handleApprove(service.id)} size="sm" className="gap-1">
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </Button>
                      <Button onClick={() => openEditDialog(service)} variant="outline" size="sm" className="gap-1">
                        <Edit className="w-4 h-4" />
                        Edit
                      </Button>
                      <Button onClick={() => handleReject(service.id)} variant="destructive" size="sm" className="gap-1">
                        <XCircle className="w-4 h-4" />
                        Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingService} onOpenChange={(open) => !open && setEditingService(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Service Event</DialogTitle>
            <DialogDescription>Make changes to the service details before approving</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Service Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-date">Date</Label>
              <Input
                id="edit-date"
                type="date"
                value={editForm.service_date}
                onChange={(e) => setEditForm({ ...editForm, service_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-time">Start Time</Label>
              <Input
                id="edit-time"
                type="time"
                value={editForm.start_time}
                onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                value={editForm.location}
                onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingService(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
