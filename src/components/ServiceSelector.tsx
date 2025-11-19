import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay, parseISO } from "date-fns";
import { CalendarDays, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Service {
  id: string;
  name: string;
  service_date: string;
  service_type: string;
  start_time?: string;
  location?: string;
  description?: string;
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  useEffect(() => {
    if (selectedCategory) {
      loadServicesForCategory(selectedCategory);
    }
  }, [selectedCategory]);

  const loadServicesForCategory = async (category: string) => {
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("service_type", category as any)
      .eq("is_published", true)
      .gte("service_date", new Date().toISOString().split('T')[0])
      .order("service_date", { ascending: true });

    if (error) {
      console.error("Error loading services:", error);
      return;
    }

    setServices(data || []);
    setSelectedDate(undefined);
    setSelectedService(null);
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
  
  const isDateAvailable = (date: Date) => {
    return serviceDates.some(serviceDate => isSameDay(serviceDate, date));
  };

  const getServicesForDate = (date: Date) => {
    return services.filter(s => isSameDay(parseISO(s.service_date), date));
  };

  if (!selectedCategory) {
    return (
      <div className="space-y-4">
        <Label className="text-base font-semibold">Select Event Category</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {serviceCategories.map((category) => (
            <Card
              key={category.type}
              className={`cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-lg bg-gradient-to-br ${category.color} border-border/50 hover:border-primary/50`}
              onClick={() => handleCategorySelect(category.type)}
            >
              <CardContent className="p-6 flex items-center space-x-4">
                <div className="text-4xl">{category.icon}</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{category.label}</h3>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
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
          <CardContent className="p-8 text-center">
            <CalendarDays className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No upcoming events for this category</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Select Event Date</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                disabled={(date) => !isDateAvailable(date) || date < new Date()}
                modifiers={{
                  available: serviceDates
                }}
                modifiersClassNames={{
                  available: "bg-primary/20 font-bold hover:bg-primary/30"
                }}
                className="rounded-md border"
              />
            </CardContent>
          </Card>

          {selectedDate && selectedService && (
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/30 animate-fade-in">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center space-x-2">
                  <Badge variant="default">Selected Event</Badge>
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
    </div>
  );
};

// Don't forget to add Label and Button imports
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
