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
import { toast } from "sonner";
import { ArrowLeft, Bell, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface Service {
  id: string;
  name: string;
  service_date: string;
}

interface Reminder {
  id: string;
  service_id: string;
  reminder_type: string;
  send_before_hours: number;
  message: string;
  sent_at: string | null;
  services: Service;
}

const EventReminders = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    service_id: "",
    reminder_type: "email",
    send_before_hours: 24,
    message: ""
  });
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load upcoming services
      const { data: servicesData, error: servicesError } = await supabase
        .from("services")
        .select("id, name, service_date")
        .gte("service_date", new Date().toISOString().split('T')[0])
        .eq("is_archived", false)
        .order("service_date");

      if (servicesError) throw servicesError;
      setServices(servicesData || []);

      // Load reminders
      const { data: remindersData, error: remindersError } = await supabase
        .from("event_reminders")
        .select("*, services(id, name, service_date)")
        .order("created_at", { ascending: false });

      if (remindersError) throw remindersError;
      setReminders(remindersData || []);
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    }
  };

  const handleCreateReminder = async () => {
    if (!formData.service_id) {
      toast.error("Please select a service");
      return;
    }

    try {
      const { error } = await supabase
        .from("event_reminders")
        .insert({
          service_id: formData.service_id,
          reminder_type: formData.reminder_type,
          send_before_hours: formData.send_before_hours,
          message: formData.message
        });

      if (error) throw error;

      toast.success("Reminder created successfully");
      setIsDialogOpen(false);
      setFormData({
        service_id: "",
        reminder_type: "email",
        send_before_hours: 24,
        message: ""
      });
      await loadData();
    } catch (error: any) {
      console.error("Error creating reminder:", error);
      toast.error("Failed to create reminder");
    }
  };

  const handleDeleteReminder = async (id: string) => {
    try {
      const { error } = await supabase
        .from("event_reminders")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Reminder deleted successfully");
      await loadData();
    } catch (error: any) {
      console.error("Error deleting reminder:", error);
      toast.error("Failed to delete reminder");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/admin/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-6 w-6" />
                  Event Reminders
                </CardTitle>
                <CardDescription>
                  Manage automated reminders for upcoming services
                </CardDescription>
              </div>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Reminder
              </Button>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {reminders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No reminders configured</p>
                </div>
              ) : (
                reminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex-1">
                      <h3 className="font-semibold">{reminder.services.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(reminder.services.service_date), "PPP")}
                      </p>
                      <p className="text-sm mt-2">
                        <span className="font-medium">Type:</span> {reminder.reminder_type} •{" "}
                        <span className="font-medium">Send:</span> {reminder.send_before_hours}h before
                      </p>
                      {reminder.message && (
                        <p className="text-sm text-muted-foreground mt-1">{reminder.message}</p>
                      )}
                      {reminder.sent_at && (
                        <p className="text-xs text-green-600 mt-1">
                          Sent: {format(new Date(reminder.sent_at), "PPP p")}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteReminder(reminder.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Event Reminder</DialogTitle>
              <DialogDescription>
                Set up an automated reminder for an upcoming service
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="service">Service</Label>
                <Select
                  value={formData.service_id}
                  onValueChange={(value) => setFormData({ ...formData, service_id: value })}
                >
                  <SelectTrigger id="service">
                    <SelectValue placeholder="Select service" />
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

              <div className="space-y-2">
                <Label htmlFor="type">Reminder Type</Label>
                <Select
                  value={formData.reminder_type}
                  onValueChange={(value) => setFormData({ ...formData, reminder_type: value })}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hours">Send Before (Hours)</Label>
                <Input
                  id="hours"
                  type="number"
                  min="1"
                  value={formData.send_before_hours}
                  onChange={(e) => setFormData({ ...formData, send_before_hours: parseInt(e.target.value) })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Custom Message (Optional)</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Enter a custom message for this reminder"
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateReminder}>Create Reminder</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default EventReminders;
