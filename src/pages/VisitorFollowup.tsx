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
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ArrowLeft, UserPlus, CalendarIcon, Phone, Mail, CheckCircle, X, UserCheck, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { hasAdminAccess } from "../lib/roles";
import { BulkActionBar } from "@/components/BulkActionBar";

interface Contact {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  first_visit_date: string | null;
  visit_count: number;
}

interface Followup {
  id: string;
  contact_id: string;
  follow_up_type: string;
  status: string;
  scheduled_date: string | null;
  completed_date: string | null;
  notes: string | null;
  assigned_to: string | null;
  contacts: Contact;
}

const VisitorFollowup = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<string>("");
  const [formData, setFormData] = useState({
    follow_up_type: "call",
    scheduled_date: undefined as Date | undefined,
    notes: "",
    assigned_to: ""
  });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
  const [bulkAssignTo, setBulkAssignTo] = useState<string>("");
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Check auth first
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate("/admin/auth");
        return;
      }

      // Load ALL roles for this user (NOT single)
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      if (rolesError) {
        console.error("Error loading roles:", rolesError);
      }

      const mainRole = rolesData && rolesData.length > 0 ? rolesData[0].role : null;

      if (!hasAdminAccess(mainRole)) {
        toast.error("Access denied. Admin privileges required.");
        navigate("/dashboard");
        return;
      }

      // Load visitors (contacts with recent visits)
      const { data: contactsData, error: contactsError } = await supabase
        .from("contacts")
        .select("*")
        .eq("contact_type", "visitor")
        .order("last_visit_date", { ascending: false });

      if (contactsError) throw contactsError;
      setContacts(contactsData || []);

      // Load all active users for assignment
      const { data: usersData, error: usersError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("is_active", true)
        .order("full_name");

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Load follow-ups
      const { data: followupsData, error: followupsError } = await supabase
        .from("visitor_followups")
        .select("*, contacts(*)")
        .order("scheduled_date", { ascending: true });

      if (followupsError) throw followupsError;
      setFollowups(followupsData || []);
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    }
  };

  const handleCreateFollowup = async () => {
    if (!selectedContact) {
      toast.error("Please select a visitor");
      return;
    }

    try {
      const { error } = await supabase
        .from("visitor_followups")
        .insert({
          contact_id: selectedContact,
          follow_up_type: formData.follow_up_type,
          scheduled_date: formData.scheduled_date?.toISOString().split('T')[0],
          notes: formData.notes,
          assigned_to: formData.assigned_to || null,
          status: "pending"
        });

      if (error) throw error;

      toast.success("Follow-up created successfully");
      setIsDialogOpen(false);
      setSelectedContact("");
      setFormData({
        follow_up_type: "call",
        scheduled_date: undefined,
        notes: "",
        assigned_to: ""
      });
      await loadData();
    } catch (error: any) {
      console.error("Error creating follow-up:", error);
      toast.error("Failed to create follow-up");
    }
  };

  const handleCompleteFollowup = async (id: string) => {
    try {
      const { error } = await supabase
        .from("visitor_followups")
        .update({
          status: "completed",
          completed_date: new Date().toISOString().split('T')[0]
        })
        .eq("id", id);

      if (error) throw error;

      toast.success("Follow-up marked as completed");
      await loadData();
    } catch (error: any) {
      console.error("Error completing follow-up:", error);
      toast.error("Failed to complete follow-up");
    }
  };

  const handleCancelFollowup = async (id: string) => {
    try {
      const { error } = await supabase
        .from("visitor_followups")
        .update({ status: "cancelled" })
        .eq("id", id);

      if (error) throw error;

      toast.success("Follow-up cancelled");
      await loadData();
    } catch (error: any) {
      console.error("Error cancelling follow-up:", error);
      toast.error("Failed to cancel follow-up");
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    setSelectedIds(prev =>
      prev.length === filteredFollowups.length ? [] : filteredFollowups.map(f => f.id)
    );
  };

  const handleBulkAssign = async () => {
    if (!bulkAssignTo) {
      toast.error("Please select a user to assign to");
      return;
    }

    try {
      const { error } = await supabase
        .from("visitor_followups")
        .update({ assigned_to: bulkAssignTo })
        .in("id", selectedIds);

      if (error) throw error;

      toast.success(`Assigned ${selectedIds.length} follow-up(s) successfully`);
      setBulkAssignDialogOpen(false);
      setSelectedIds([]);
      setBulkAssignTo("");
      await loadData();
    } catch (error: any) {
      console.error("Error assigning follow-ups:", error);
      toast.error("Failed to assign follow-ups");
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus) {
      toast.error("Please select a status");
      return;
    }

    try {
      const updates: any = { status: bulkStatus };
      if (bulkStatus === "completed") {
        updates.completed_date = new Date().toISOString().split('T')[0];
      }

      const { error } = await supabase
        .from("visitor_followups")
        .update(updates)
        .in("id", selectedIds);

      if (error) throw error;

      toast.success(`Updated ${selectedIds.length} follow-up(s) successfully`);
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
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "default",
      in_progress: "default",
      completed: "secondary",
      cancelled: "destructive"
    };

    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  let filteredFollowups = statusFilter === "all"
    ? followups
    : followups.filter(f => f.status === statusFilter);

  if (assignedFilter !== "all") {
    filteredFollowups = filteredFollowups.filter(f =>
      assignedFilter === "unassigned" ? !f.assigned_to : f.assigned_to === assignedFilter
    );
  }

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
                  <UserPlus className="h-6 w-6" />
                  Visitor Follow-up System
                </CardTitle>
                <CardDescription>
                  Track and manage follow-ups with first-time visitors
                </CardDescription>
              </div>
              <Button onClick={() => setIsDialogOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                New Follow-up
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("all")}
              >
                All
              </Button>
              <Button
                variant={statusFilter === "pending" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("pending")}
              >
                Pending
              </Button>
              <Button
                variant={statusFilter === "completed" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("completed")}
              >
                Completed
              </Button>
              <Button
                variant={statusFilter === "cancelled" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("cancelled")}
              >
                Cancelled
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {filteredFollowups.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <UserPlus className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No follow-ups found</p>
                </div>
              ) : (
                filteredFollowups.map((followup) => (
                  <div
                    key={followup.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{followup.contacts.full_name}</h3>
                        {getStatusBadge(followup.status)}
                      </div>
                      <div className="text-sm space-y-1">
                        <p className="flex items-center gap-2">
                          {followup.follow_up_type === "call" && <Phone className="h-4 w-4" />}
                          {followup.follow_up_type === "email" && <Mail className="h-4 w-4" />}
                          <span className="capitalize">{followup.follow_up_type}</span>
                        </p>
                        <p className="text-muted-foreground">
                          {followup.contacts.email} {followup.contacts.phone && `• ${followup.contacts.phone}`}
                        </p>
                        {followup.scheduled_date && (
                          <p className="text-muted-foreground">
                            Scheduled: {format(new Date(followup.scheduled_date), "PPP")}
                          </p>
                        )}
                        {followup.completed_date && (
                          <p className="text-green-600 text-xs">
                            Completed: {format(new Date(followup.completed_date), "PPP")}
                          </p>
                        )}
                        {followup.notes && (
                          <p className="text-muted-foreground italic mt-2">{followup.notes}</p>
                        )}
                      </div>
                    </div>
                    {followup.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCompleteFollowup(followup.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCancelFollowup(followup.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Visitor Follow-up</DialogTitle>
              <DialogDescription>
                Schedule a follow-up with a first-time visitor
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="contact">Visitor</Label>
                <Select
                  value={selectedContact}
                  onValueChange={setSelectedContact}
                >
                  <SelectTrigger id="contact">
                    <SelectValue placeholder="Select visitor" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.full_name} - {contact.email}
                        {contact.first_visit_date && (
                          <span className="text-xs text-muted-foreground ml-2">
                            (First visit: {format(new Date(contact.first_visit_date), "PP")})
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Follow-up Type</Label>
                <Select
                  value={formData.follow_up_type}
                  onValueChange={(value) => setFormData({ ...formData, follow_up_type: value })}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="call">Phone Call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="visit">In-Person Visit</SelectItem>
                    <SelectItem value="message">Message</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Scheduled Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.scheduled_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.scheduled_date ? format(formData.scheduled_date, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.scheduled_date}
                      onSelect={(date) => setFormData({ ...formData, scheduled_date: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assigned_to">Assign To (Optional)</Label>
                <Select
                  value={formData.assigned_to}
                  onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}
                >
                  <SelectTrigger id="assigned_to">
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add any notes about this follow-up"
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateFollowup}>Create Follow-up</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default VisitorFollowup;
