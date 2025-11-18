import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import { ArrowLeft, CalendarIcon, Plus, Edit, Trash, Users } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    service_type: "other",
    service_date: new Date(),
    start_time: "",
    location: "",
    description: "",
  });

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
      
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error) throw error;
      
      if (profileData.role !== 'admin' && profileData.role !== 'finance' && profileData.role !== 'pastor') {
        toast.error("Access denied. Admin privileges required.");
        navigate("/dashboard");
        return;
      }
      
      await loadServices();
    } catch (error: any) {
      console.error("Error loading profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .order('service_date', { ascending: false });

      if (error) throw error;
      setServices(data || []);
    } catch (error: any) {
      console.error("Error loading services:", error);
      toast.error("Failed to load services");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);

      const serviceData = {
        name: formData.name,
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
        const { error } = await supabase
          .from("services")
          .insert(serviceData);

        if (error) throw error;
        toast.success("Event created successfully!");
      }

      setIsDialogOpen(false);
      setEditingService(null);
      resetForm();
      await loadServices();
    } catch (error: any) {
      console.error("Error saving service:", error);
      toast.error("Failed to save event");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      service_type: service.service_type,
      service_date: new Date(service.service_date),
      start_time: service.start_time || "",
      location: service.location || "",
      description: service.description || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (serviceId: string) => {
    if (!confirm("Are you sure you want to delete this event? This will also delete all associated attendance records.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("services")
        .delete()
        .eq('id', serviceId);

      if (error) throw error;
      toast.success("Event deleted successfully!");
      await loadServices();
    } catch (error: any) {
      console.error("Error deleting service:", error);
      toast.error("Failed to delete event");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      service_type: "other",
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

  const filteredServices = filterType === 'all' 
    ? services 
    : services.filter(s => s.service_type === filterType);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/admin/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Events Calendar</h1>
            <p className="text-muted-foreground mt-1">
              Manage services and special events
            </p>
          </div>
          <Button onClick={() => {
            resetForm();
            setEditingService(null);
            setIsDialogOpen(true);
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Create Event
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filter by Service Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filterType === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterType('all')}
                size="sm"
              >
                All ({services.length})
              </Button>
              {serviceTypes.map(type => {
                const count = services.filter(s => s.service_type === type.value).length;
                return (
                  <Button
                    key={type.value}
                    variant={filterType === type.value ? 'default' : 'outline'}
                    onClick={() => setFilterType(type.value)}
                    size="sm"
                  >
                    {type.label} ({count})
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service) => (
            <Card key={service.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      {getServiceTypeBadge(service.service_type)}
                      {!service.is_published && (
                        <Badge variant="outline">Draft</Badge>
                      )}
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
                {service.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {service.description}
                  </p>
                )}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4" />
                    <span className="font-semibold">{service.total_attendance}</span>
                    <span className="text-muted-foreground">attendees</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
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
                    onClick={() => handleDelete(service.id)}
                  >
                    <Trash className="h-4 w-4" />
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
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingService ? 'Edit Event' : 'Create New Event'}
            </DialogTitle>
            <DialogDescription>
              Add event details including date, time, and location
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Event Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Sunday Service - Week 1"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

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
                className="min-h-[100px]"
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
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : editingService ? "Update Event" : "Create Event"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventsManagement;
