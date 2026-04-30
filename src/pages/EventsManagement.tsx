import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import { ArrowLeft, CalendarIcon, Plus, Edit, Trash, Users, Loader2, Archive, RotateCcw, ImageIcon, Upload, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";
import { getHighestRole, hasAdminAccess } from "@/lib/roles";

type AppRole = Database["public"]["Enums"]["app_role"];

interface Service {
  id: string;
  name: string;
  service_type: string;
  service_date: string;
  start_time: string | null;
  location: string | null;
  description: string | null;
  total_attendance: number;
  is_published: boolean;
  is_archived: boolean;
  deleted_at: string | null;
  created_at: string;
}

const serviceTypes = [
  { value: 'tuesday_fellowship', label: 'Tuesday Fellowship' },
  { value: 'thursday_livestream', label: 'Thursday Livestream' },
  { value: 'ltc', label: 'LTC' },
  { value: 'sunday_service', label: 'Sunday Service' },
  { value: 'gic', label: 'GIC' },
  { value: 'nop', label: 'NOP' },
  { value: 'men_gather', label: 'Men Gather' },
  { value: 'mgp', label: 'MGP' },
  { value: 'other', label: 'Other' },
];

const EventsManagement = () => {
  const [user, setUser] = useState<User | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [archivedServices, setArchivedServices] = useState<Service[]>([]);
  const [mobilizationCounts, setMobilizationCounts] = useState<Map<string, number>>(new Map());
  const [mobilizationTargets, setMobilizationTargets] = useState<Map<string, { invitations: number; confirmations: number }>>(new Map());
  const [isRescheduleDialogOpen, setIsRescheduleDialogOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<Date>(new Date());
  const [rescheduleServiceId, setRescheduleServiceId] = useState<string | null>(null);
  
  // Delete/archive confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null);
  const [deleteMode, setDeleteMode] = useState<'archive' | 'permanent'>('archive');
  const [isDeleting, setIsDeleting] = useState(false);
  
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    customName: "", // For "Other" type
    service_type: "sunday_service",
    service_date: new Date(),
    start_time: "",
    location: "",
    description: "",
    flyer_url: "" as string | null | "",
    flyer_alt: "",
  });
  const [flyerFile, setFlyerFile] = useState<File | null>(null);
  const [isUploadingFlyer, setIsUploadingFlyer] = useState(false);

  const uploadFlyer = async (file: File, serviceId: string): Promise<string> => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${serviceId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("event-flyers")
      .upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    const { data } = supabase.storage.from("event-flyers").getPublicUrl(path);
    return data.publicUrl;
  };

  // Auto-generate event name from service type and date
  const getServiceTypeLabel = (type: string) => 
    serviceTypes.find(st => st.value === type)?.label || 'Event';

  const generateEventName = (type: string, date: Date, customName?: string) => {
    if (type === 'other' && customName?.trim()) {
      return `${customName.trim()} - ${format(date, 'MMMM do, yyyy')}`;
    }
    return `${getServiceTypeLabel(type)} - ${format(date, 'MMMM do, yyyy')}`;
  };

  useEffect(() => {
    checkUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate("/admin/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate("/admin/auth");
        return;
      }
      
      setUser(session.user);

      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      if (rolesError) {
        console.error("Error loading roles:", rolesError);
      }

      const mainRole = getHighestRole(rolesData?.map(({ role }) => role));

      if (!hasAdminAccess(mainRole)) {
        toast.error("Access denied. Admin privileges required.");
        navigate("/dashboard");
        return;
      }

      setLoading(true);
      Promise.all([loadServices(), loadMobilizationCounts(), loadMobilizationTargets()]).finally(() => setLoading(false));
    } catch (error: any) {
      console.error("Error:", error);
      toast.error("Failed to load profile");
    }
  };

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .or("is_archived.eq.false,is_archived.is.null")
        .is("deleted_at", null)
        .order('service_date', { ascending: false });

      if (error) throw error;
      setServices(data || []);
    } catch (error: any) {
      console.error("Error loading services:", error);
      toast.error("Failed to load services");
    }
  };

  const loadArchivedServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("is_archived", true)
        .order('service_date', { ascending: false });

      if (error) throw error;
      setArchivedServices(data || []);
    } catch (error: any) {
      console.error("Error loading archived services:", error);
      toast.error("Failed to load archived services");
    }
  };

  const loadMobilizationCounts = async () => {
    try {
      const { data, error } = await supabase
        .from("member_invitations")
        .select("target_service_id, status");

      if (error) throw error;

      // Count invitations and confirmations per service
      const counts = new Map<string, number>();
      const confirmedCounts = new Map<string, number>();
      data?.forEach(inv => {
        if (inv.target_service_id) {
          counts.set(inv.target_service_id, (counts.get(inv.target_service_id) || 0) + 1);
          if (inv.status === 'confirmed' || inv.status === 'attended') {
            confirmedCounts.set(inv.target_service_id, (confirmedCounts.get(inv.target_service_id) || 0) + 1);
          }
        }
      });
      setMobilizationCounts(counts);
    } catch (error: any) {
      console.error("Error loading mobilization counts:", error);
    }
  };

  const loadMobilizationTargets = async () => {
    try {
      const { data, error } = await supabase
        .from("mobilization_targets")
        .select("service_id, target_invitations, target_confirmations");

      if (error) throw error;

      const targets = new Map<string, { invitations: number; confirmations: number }>();
      data?.forEach(target => {
        targets.set(target.service_id, {
          invitations: target.target_invitations,
          confirmations: target.target_confirmations
        });
      });
      setMobilizationTargets(targets);
    } catch (error: any) {
      console.error("Error loading mobilization targets:", error);
    }
  };

  const handleRestore = async (serviceId: string) => {
    try {
      const { error } = await supabase
        .from("services")
        .update({ 
          is_archived: false,
          deleted_at: null 
        })
        .eq('id', serviceId);

      if (error) throw error;
      toast.success("Event restored successfully!");
      await loadServices();
      await loadArchivedServices();
    } catch (error: any) {
      console.error("Error restoring service:", error);
      toast.error("Failed to restore event");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation for "Other" type requiring custom name
    if (formData.service_type === 'other' && !formData.customName.trim()) {
      toast.error("Please enter a custom event name for 'Other' type");
      return;
    }
    
    try {
      setIsSubmitting(true);

      // Auto-generate event name
      const generatedName = generateEventName(
        formData.service_type, 
        formData.service_date,
        formData.customName
      );

      const serviceData = {
        name: generatedName,
        service_type: formData.service_type as "gic" | "ltc" | "men_gather" | "mgp" | "nop" | "other" | "sunday_service" | "thursday_livestream" | "tuesday_fellowship",
        service_date: format(formData.service_date, 'yyyy-MM-dd'),
        start_time: formData.start_time || null,
        location: formData.location || null,
        description: formData.description || null,
      };

      if (editingService) {
        const { error } = await supabase
          .from("services")
          .update(serviceData)
          .eq('id', editingService.id);

        if (error) throw error;
        toast.success("Event updated successfully!");
      } else {
        // Add created_by and approval_status for new events
        const { error } = await supabase
          .from("services")
          .insert({
            ...serviceData,
            created_by: user?.id,
            approval_status: 'approved',
          });

        if (error) throw error;
        toast.success("Event created successfully!");
      }

      setIsDialogOpen(false);
      setEditingService(null);
      resetForm();
      await loadServices();
    } catch (error: any) {
      console.error("Error saving service:", error);
      toast.error(error.message || "Failed to save event");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    
    // Extract custom name from existing name for "Other" type
    const isOther = service.service_type === 'other';
    let customName = "";
    if (isOther) {
      // Try to extract the custom name part before the date
      const parts = service.name.split(' - ');
      if (parts.length > 1) {
        customName = parts[0];
      }
    }
    
    setFormData({
      customName,
      service_type: service.service_type,
      service_date: new Date(service.service_date),
      start_time: service.start_time || "",
      location: service.location || "",
      description: service.description || "",
    });
    setIsDialogOpen(true);
  };

  const confirmArchive = (serviceId: string) => {
    setDeletingServiceId(serviceId);
    setDeleteMode('archive');
    setDeleteDialogOpen(true);
  };

  const confirmPermanentDelete = (serviceId: string) => {
    setDeletingServiceId(serviceId);
    setDeleteMode('permanent');
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingServiceId) return;

    try {
      setIsDeleting(true);

      if (deleteMode === 'permanent') {
        const { error } = await supabase
          .from("services")
          .delete()
          .eq('id', deletingServiceId);

        if (error) throw error;
        toast.success("Event deleted permanently!");
        await loadArchivedServices();
      } else {
        // Soft delete: set deleted_at and is_archived instead of hard delete
        const { error } = await supabase
          .from("services")
          .update({ 
            deleted_at: new Date().toISOString(),
            is_archived: true 
          })
          .eq('id', deletingServiceId);

        if (error) throw error;
        toast.success("Event archived successfully!");
        await loadServices();
      }
    } catch (error: any) {
      console.error("Error deleting service:", error);
      toast.error(
        deleteMode === 'permanent'
          ? error.message || "Failed to delete event. If it has linked attendance or giving records, archive it instead."
          : error.message || "Failed to archive event"
      );
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDeletingServiceId(null);
      setDeleteMode('archive');
    }
  };

  const resetForm = () => {
    setFormData({
      customName: "",
      service_type: "sunday_service",
      service_date: new Date(),
      start_time: "",
      location: "",
      description: "",
    });
  };

  const getServiceTypeBadge = (type: string) => {
    const serviceType = serviceTypes.find(st => st.value === type);
    const colors: { [key: string]: string } = {
      'sunday_service': 'bg-blue-500',
      'tuesday_fellowship': 'bg-green-500',
      'thursday_livestream': 'bg-purple-500',
      'ltc': 'bg-orange-500',
      'gic': 'bg-red-500',
      'nop': 'bg-pink-500',
      'men_gather': 'bg-indigo-500',
      'mgp': 'bg-yellow-500',
      'other': 'bg-gray-500',
    };

    return (
      <Badge className={colors[type] || 'bg-gray-500'}>
        {serviceType?.label || type}
      </Badge>
    );
  };

  const getEventStatus = (serviceDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(serviceDate);
    eventDate.setHours(0, 0, 0, 0);
    
    if (eventDate.getTime() === today.getTime()) return 'today';
    if (eventDate > today) return 'upcoming';
    return 'past';
  };

  const getStatusBadge = (serviceDate: string) => {
    const status = getEventStatus(serviceDate);
    
    if (status === 'today') {
      return <Badge className="bg-blue-500">Today</Badge>;
    } else if (status === 'upcoming') {
      return <Badge className="bg-green-500">Upcoming</Badge>;
    } else {
      return <Badge className="bg-red-500">Expired</Badge>;
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleServiceId) return;

    try {
      const { error } = await supabase
        .from("services")
        .update({ service_date: format(rescheduleDate, 'yyyy-MM-dd') })
        .eq('id', rescheduleServiceId);

      if (error) throw error;
      toast.success("Event rescheduled successfully!");
      setIsRescheduleDialogOpen(false);
      setRescheduleServiceId(null);
      await loadServices();
    } catch (error: any) {
      console.error("Error rescheduling service:", error);
      toast.error("Failed to reschedule event");
    }
  };

  const handleArchive = async (serviceId: string, archive: boolean) => {
    try {
      const { error } = await supabase
        .from("services")
        .update({ 
          is_archived: archive,
          deleted_at: archive ? new Date().toISOString() : null
        })
        .eq('id', serviceId);

      if (error) throw error;
      toast.success(archive ? "Event archived successfully!" : "Event restored successfully!");
      await loadServices();
      if (showArchived) await loadArchivedServices();
    } catch (error: any) {
      console.error("Error archiving service:", error);
      toast.error("Failed to archive event");
    }
  };

  const filteredServices = services.filter(s => {
    if (filterType !== 'all' && s.service_type !== filterType) return false;
    
    if (statusFilter === 'upcoming') return getEventStatus(s.service_date) === 'upcoming';
    if (statusFilter === 'past') return getEventStatus(s.service_date) === 'past';
    if (statusFilter === 'today') return getEventStatus(s.service_date) === 'today';
    
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-7xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/admin/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Events Calendar</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              Manage services and special events
            </p>
          </div>
          <Button className="w-full sm:w-auto" onClick={() => {
            resetForm();
            setEditingService(null);
            setIsDialogOpen(true);
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Create Event
          </Button>
        </div>

        {/* Compact Filter Bar */}
        <div className="sticky top-0 z-20 mb-6 rounded-lg border bg-background/95 p-3 sm:p-4 backdrop-blur space-y-3 sm:space-y-0 sm:flex sm:items-center sm:gap-4">
          <div className="w-full sm:w-auto">
            <span className="text-xs font-medium text-muted-foreground block mb-1.5 sm:hidden">Status</span>
            <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1 scrollbar-hide">
              <Button
                variant={statusFilter === 'all' && !showArchived ? 'default' : 'ghost'}
                onClick={() => { setStatusFilter('all'); setShowArchived(false); }}
                size="sm"
                className="h-8 flex-shrink-0 text-xs sm:text-sm"
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'upcoming' ? 'default' : 'ghost'}
                onClick={() => { setStatusFilter('upcoming'); setShowArchived(false); }}
                size="sm"
                className="h-8 flex-shrink-0 text-xs sm:text-sm"
              >
                Upcoming
              </Button>
              <Button
                variant={statusFilter === 'today' ? 'default' : 'ghost'}
                onClick={() => { setStatusFilter('today'); setShowArchived(false); }}
                size="sm"
                className="h-8 flex-shrink-0 text-xs sm:text-sm"
              >
                Today
              </Button>
              <Button
                variant={statusFilter === 'past' ? 'default' : 'ghost'}
                onClick={() => { setStatusFilter('past'); setShowArchived(false); }}
                size="sm"
                className="h-8 flex-shrink-0 text-xs sm:text-sm"
              >
                Past
              </Button>
              <Button
                variant={showArchived ? 'default' : 'ghost'}
                onClick={() => { 
                  setShowArchived(true); 
                  setStatusFilter('all');
                  loadArchivedServices();
                }}
                size="sm"
                className="h-8 flex-shrink-0 text-xs sm:text-sm"
              >
                <Archive className="h-3 w-3 mr-1" />
                Archived
              </Button>
            </div>
          </div>

          <div className="hidden sm:block h-8 w-px bg-border flex-shrink-0" />

          <div className="flex items-center gap-2 sm:gap-3 justify-between sm:flex-1">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-xs sm:text-sm font-medium text-muted-foreground flex-shrink-0">Type:</span>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-8 w-full sm:w-52 text-xs sm:text-sm">
                  <SelectValue placeholder="All Service Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All ({services.length})
                  </SelectItem>
                  {serviceTypes.map(type => {
                    const count = services.filter(s => s.service_type === type.value).length;
                    return (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label} ({count})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <span className="text-xs sm:text-sm text-muted-foreground flex-shrink-0">
              {showArchived ? archivedServices.length : filteredServices.length} event{(showArchived ? archivedServices.length : filteredServices.length) !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Active Events Grid */}
        {!showArchived && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {filteredServices.map((service) => (
                <Card key={service.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="p-4 sm:p-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          {getServiceTypeBadge(service.service_type)}
                          {getStatusBadge(service.service_date)}
                          {!service.is_published && (
                            <Badge variant="outline">Draft</Badge>
                          )}
                        </div>
                        <CardTitle className="text-base sm:text-xl leading-tight">{service.name}</CardTitle>
                      </div>
                    </div>
                    <CardDescription>
                      <div className="space-y-1 mt-2">
                        <p className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4" />
                          {format(new Date(service.service_date), 'PPP')}
                        </p>
                        {service.start_time && (
                          <p className="text-sm">Time: {service.start_time}</p>
                        )}
                        {service.location && (
                          <p className="text-sm">Location: {service.location}</p>
                        )}
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
                    {service.description && (
                      <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 line-clamp-2">
                        {service.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <span className="font-semibold">{service.total_attendance}</span>
                          <span className="text-muted-foreground">attendees</span>
                        </div>
                        {(getEventStatus(service.service_date) === 'upcoming' || getEventStatus(service.service_date) === 'today') && (
                          <Link 
                            to={`/admin/mobilization/service/${service.id}`}
                            className="flex items-center gap-1.5 text-primary hover:underline"
                          >
                            <Users className="h-4 w-4" />
                            <span className="font-semibold">
                              Mobilized {mobilizationCounts.get(service.id) || 0}
                              {mobilizationTargets.get(service.id) && (
                                <span className="text-muted-foreground">/{mobilizationTargets.get(service.id)?.invitations}</span>
                              )}
                            </span>
                          </Link>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 min-w-[9rem]"
                        onClick={() => navigate(`/admin/attendance/${service.id}`)}
                      >
                        <Users className="h-4 w-4 mr-1" />
                        Log Attendance
                      </Button>
                      {getEventStatus(service.service_date) === 'past' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRescheduleServiceId(service.id);
                            setRescheduleDate(new Date(service.service_date));
                            setIsRescheduleDialogOpen(true);
                          }}
                        >
                          <CalendarIcon className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(service)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => confirmArchive(service.id)}
                        disabled={isDeleting && deletingServiceId === service.id}
                      >
                        {isDeleting && deletingServiceId === service.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Archive className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredServices.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <CalendarIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No events found for this filter</p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Archived Events Grid */}
        {showArchived && (
          <>
            <div className="mb-4 p-4 bg-muted/50 rounded-lg border">
              <p className="text-sm text-muted-foreground">
                <Archive className="h-4 w-4 inline mr-2" />
                Archived events are preserved for historical records. Attendance data is retained even after archiving.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {archivedServices.map((service) => (
                <Card key={service.id} className="hover:shadow-lg transition-shadow opacity-75">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getServiceTypeBadge(service.service_type)}
                          <Badge variant="secondary" className="bg-muted">
                            <Archive className="h-3 w-3 mr-1" />
                            Archived
                          </Badge>
                        </div>
                        <CardTitle className="text-xl">{service.name}</CardTitle>
                      </div>
                    </div>
                    <CardDescription>
                      <div className="space-y-1 mt-2">
                        <p className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4" />
                          {format(new Date(service.service_date), 'PPP')}
                        </p>
                        {service.start_time && (
                          <p className="text-sm">Time: {service.start_time}</p>
                        )}
                        {service.location && (
                          <p className="text-sm">Location: {service.location}</p>
                        )}
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4" />
                        <span className="font-semibold">{service.total_attendance}</span>
                        <span className="text-muted-foreground">attendees</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 min-w-[9rem]"
                        onClick={() => navigate(`/admin/attendance/${service.id}`)}
                      >
                        <Users className="h-4 w-4 mr-1" />
                        Log Attendance
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(service)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(service.id)}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => confirmPermanentDelete(service.id)}
                        disabled={isDeleting && deletingServiceId === service.id}
                      >
                        {isDeleting && deletingServiceId === service.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {archivedServices.length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Archive className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No archived events</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Create/Edit Event Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingService ? 'Edit Event' : 'Create New Event'}
            </DialogTitle>
            <DialogDescription>
              Select service type and date - name will be auto-generated
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="service_type">Service Type *</Label>
              <Select
                value={formData.service_type}
                onValueChange={(value) => setFormData({ ...formData, service_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {serviceTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom name field for "Other" type */}
            {formData.service_type === 'other' && (
              <div className="space-y-2">
                <Label htmlFor="customName">Custom Event Name *</Label>
                <Input
                  id="customName"
                  placeholder="e.g., Youth Conference, Workshop"
                  value={formData.customName}
                  onChange={(e) => setFormData({ ...formData, customName: e.target.value })}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  This will be combined with the date: "{formData.customName || 'Event'} - {format(formData.service_date, 'MMMM do, yyyy')}"
                </p>
              </div>
            )}

            {/* Preview generated name */}
            {formData.service_type !== 'other' && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">Event name (auto-generated):</p>
                <p className="font-medium">{generateEventName(formData.service_type, formData.service_date)}</p>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Event Date *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.service_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(formData.service_date, "PPP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.service_date}
                      onSelect={(date) => date && setFormData({ ...formData, service_date: date })}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="start_time">Start Time</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g., Main Sanctuary, Online"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Add event details, theme, or special notes"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="min-h-[6.25rem]"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setEditingService(null);
                  resetForm();
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : editingService ? (
                  "Update Event"
                ) : (
                  "Create Event"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={isRescheduleDialogOpen} onOpenChange={setIsRescheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Event</DialogTitle>
            <DialogDescription>
              Select a new date for this event
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label>New Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal mt-2",
                    !rescheduleDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {rescheduleDate ? format(rescheduleDate, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={rescheduleDate}
                  onSelect={(date) => date && setRescheduleDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRescheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReschedule}>
              Reschedule Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive/Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteMode === 'permanent' ? 'Delete Event Permanently' : 'Archive Event'}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteMode === 'permanent'
                ? 'This will permanently remove the event. If it has linked attendance, giving, or mobilization records, deletion may fail; archive it instead when you need to preserve reporting history.'
                : 'Are you sure you want to archive this event? The event and all attendance records will be preserved for historical reporting. You can restore it later from the Archived tab.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {deleteMode === 'permanent' ? 'Deleting...' : 'Archiving...'}
                </>
              ) : deleteMode === 'permanent' ? (
                <>
                  <Trash className="mr-2 h-4 w-4" />
                  Delete Permanently
                </>
              ) : (
                <>
                  <Archive className="mr-2 h-4 w-4" />
                  Archive Event
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EventsManagement;
