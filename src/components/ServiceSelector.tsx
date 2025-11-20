import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface Service {
  id: string;
  name: string;
  service_date: string;
  service_type: string;
  start_time?: string;
  location?: string;
  description?: string;
  approval_status?: string;
  created_by?: string;
}

interface ServiceSelectorProps {
  onServiceSelect: (serviceId: string, serviceName: string) => void;
  selectedServiceId?: string;
}

const serviceCategories = [
  { type: "sunday_service", label: "Sunday Service", color: "from-blue-500/10 to-cyan-500/10", icon: "⛪" },
  { type: "nop", label: "NOP (Night of Power)", color: "from-purple-500/10 to-pink-500/10", icon: "🌙" },
  { type: "gic", label: "GIC (Generation in Christ)", color: "from-green-500/10 to-emerald-500/10", icon: "🎯" },
  { type: "ltc", label: "LTC (Love Thy Children)", color: "from-yellow-500/10 to-orange-500/10", icon: "👶" },
  { type: "tuesday_fellowship", label: "Tuesday Fellowship", color: "from-indigo-500/10 to-blue-500/10", icon: "🙏" },
  { type: "thursday_livestream", label: "Thursday Livestream", color: "from-pink-500/10 to-rose-500/10", icon: "📹" },
  { type: "mgp", label: "MGP (My Great Price)", color: "from-violet-500/10 to-purple-500/10", icon: "💎" },
  { type: "men_gather", label: "Men's Gathering", color: "from-teal-500/10 to-cyan-500/10", icon: "🤝" },
  { type: "other", label: "Other Events", color: "from-gray-500/10 to-slate-500/10", icon: "📅" },
];

export const ServiceSelector = ({ onServiceSelect, selectedServiceId }: ServiceSelectorProps) => {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newService, setNewService] = useState({
    name: "",
    service_date: "",
    start_time: "",
    location: "",
    description: "",
  });

  useEffect(() => {
    if (selectedCategory) {
      loadServicesForCategory(selectedCategory);
    }
  }, [selectedCategory]);

  const loadServicesForCategory = async (category: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get approved services (all dates)
      const { data: approvedData, error: approvedError } = await supabase
        .from("services")
        .select("*")
        .eq("service_type", category as any)
        .eq("is_published", true)
        .eq("approval_status", "approved")
        .order("service_date", { ascending: true });

      if (approvedError) throw approvedError;

      // Get user's pending services for this category
      let pendingData: any[] = [];
      if (user) {
        const { data: userPendingData, error: pendingError } = await supabase
          .from("services")
          .select("*")
          .eq("service_type", category as any)
          .eq("created_by", user.id)
          .eq("approval_status", "pending_admin_approval")
          .order("service_date", { ascending: true });

        if (!pendingError) {
          pendingData = userPendingData || [];
        }
      }

      // Combine all services
      const allData = [...(approvedData || []), ...pendingData];
      setServices(allData);
      setSelectedDate(undefined);
      setSelectedService(null);
    } catch (error) {
      console.error("Error loading services:", error);
    }
  };

  const handleCreateService = async () => {
    if (!newService.name || !newService.service_date || !selectedCategory) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast({ title: "You must be logged in", variant: "destructive" });
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("services").insert({
      name: newService.name,
      service_type: selectedCategory as any,
      service_date: newService.service_date,
      start_time: newService.start_time || null,
      location: newService.location || null,
      description: newService.description || null,
      approval_status: "pending_admin_approval",
      created_by: user.id,
      is_published: false,
    });

    setLoading(false);

    if (error) {
      toast({ title: "Error creating service", description: error.message, variant: "destructive" });
      return;
    }

    toast({
      title: "Service submitted for approval",
      description: "An administrator will review your submission shortly.",
    });

    setShowCreateDialog(false);
    setNewService({ name: "", service_date: "", start_time: "", location: "", description: "" });
  };

  const handleCategorySelect = (type: string) => {
    setSelectedCategory(type);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    
    setSelectedDate(date);
    const serviceForDate = services.find(s => isSameDay(parseISO(s.service_date), date));
    
    if (serviceForDate) {
      setSelectedService(serviceForDate);
      onServiceSelect(serviceForDate.id, serviceForDate.name);
    }
  };

  const serviceDates = services.map(s => parseISO(s.service_date));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const pastServiceDates = services
    .filter(s => parseISO(s.service_date) < today)
    .map(s => parseISO(s.service_date));
  
  const futureServiceDates = services
    .filter(s => parseISO(s.service_date) >= today)
    .map(s => parseISO(s.service_date));
  
  const isDateAvailable = (date: Date) => {
    return serviceDates.some(serviceDate => isSameDay(serviceDate, date));
  };

  const getServicesForDate = (date: Date) => {
    return services.filter(s => isSameDay(parseISO(s.service_date), date));
  };

  if (!selectedCategory) {
    return (
      <div className="space-y-2">
        <Label htmlFor="service-category" className="text-base font-semibold">Select Service Category</Label>
        <Select value={selectedCategory || ""} onValueChange={handleCategorySelect}>
          <SelectTrigger id="service-category">
            <SelectValue placeholder="Choose a service type..." />
          </SelectTrigger>
          <SelectContent>
            {serviceCategories.map((category) => (
              <SelectItem key={category.type} value={category.type}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  const currentCategory = serviceCategories.find(c => c.type === selectedCategory);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-3xl">{currentCategory?.icon}</span>
          <div>
            <Label className="text-base font-semibold">{currentCategory?.label}</Label>
            <p className="text-sm text-muted-foreground">Select a date with available events</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSelectedCategory(null);
            setSelectedDate(undefined);
            setSelectedService(null);
          }}
        >
          Change Category
        </Button>
      </div>

      {services.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <CalendarDays className="w-12 h-12 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground mb-2">No scheduled events for this service</p>
              <p className="text-sm text-muted-foreground">You may create a new one for admin approval</p>
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              Create Service Event
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Select Event Date</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                disabled={(date) => !isDateAvailable(date)}
                modifiers={{
                  past: pastServiceDates,
                  future: futureServiceDates,
                }}
                modifiersClassNames={{
                  past: "bg-muted/50 text-muted-foreground line-through opacity-60",
                  future: "bg-primary/10 text-primary font-semibold border border-primary/20",
                }}
                className="rounded-md border"
              />
              <div className="flex gap-4 text-xs text-muted-foreground mt-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-primary/10 border border-primary/20"></div>
                  <span>Future Events</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-muted/50 border border-muted"></div>
                  <span>Past Events</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedDate && selectedService && (
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/30 animate-fade-in">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <Badge variant="default">Selected Event</Badge>
                  {selectedService.approval_status === "pending_admin_approval" && (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                      Pending Approval
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <p className="text-lg font-semibold text-foreground">{selectedService.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(parseISO(selectedService.service_date), "EEEE, MMMM d, yyyy")}
                    {selectedService.start_time && ` at ${selectedService.start_time}`}
                  </p>
                </div>
                {selectedService.location && (
                  <p className="text-sm text-muted-foreground">📍 {selectedService.location}</p>
                )}
                {selectedService.description && (
                  <p className="text-sm text-muted-foreground">{selectedService.description}</p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Service Event</DialogTitle>
            <DialogDescription>
              Submit a new {currentCategory?.label} event for admin approval
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="service-name">Service Name *</Label>
              <Input
                id="service-name"
                value={newService.name}
                onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                placeholder="e.g., Sunday Morning Worship"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service-date">Date *</Label>
              <Input
                id="service-date"
                type="date"
                value={newService.service_date}
                onChange={(e) => setNewService({ ...newService, service_date: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start-time">Start Time</Label>
              <Input
                id="start-time"
                type="time"
                value={newService.start_time}
                onChange={(e) => setNewService({ ...newService, start_time: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={newService.location}
                onChange={(e) => setNewService({ ...newService, location: e.target.value })}
                placeholder="e.g., Main Sanctuary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newService.description}
                onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                placeholder="Optional notes about this service"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateService} disabled={loading}>
              {loading ? "Submitting..." : "Submit for Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Don't forget to add Label and Button imports
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
