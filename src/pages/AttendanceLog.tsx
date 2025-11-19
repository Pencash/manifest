import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import { ArrowLeft, Save, Search, Users, CheckCircle, UserPlus, Upload } from "lucide-react";
import { format } from "date-fns";

interface Service {
  id: string;
  name: string;
  service_type: string;
  service_date: string;
  location: string | null;
  total_attendance: number;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
}

interface AttendanceRecord {
  id: string;
  profile_id: string;
  status: string;
}

const AttendanceLog = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [attendance, setAttendance] = useState<Map<string, boolean>>(new Map());
  const [existingAttendance, setExistingAttendance] = useState<Map<string, string>>(new Map());
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAddPersonDialogOpen, setIsAddPersonDialogOpen] = useState(false);
  const [newPersonData, setNewPersonData] = useState({
    full_name: "",
    email: "",
    phone: "",
    status: "visitor" // visitor or member
  });
  const navigate = useNavigate();

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
      
      await loadData();
    } catch (error: any) {
      console.error("Error loading profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    if (!serviceId) return;

    try {
      // Load service details
      const { data: serviceData, error: serviceError } = await supabase
        .from("services")
        .select("*")
        .eq("id", serviceId)
        .single();

      if (serviceError) throw serviceError;
      setService(serviceData);

      // Load all members
      const { data: membersData, error: membersError } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .eq("is_active", true)
        .order("full_name");

      if (membersError) throw membersError;
      setMembers(membersData || []);

      // Load existing attendance records
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance")
        .select("id, profile_id, status")
        .eq("service_id", serviceId);

      if (attendanceError) throw attendanceError;

      const existingMap = new Map<string, string>();
      const attendanceMap = new Map<string, boolean>();

      attendanceData?.forEach((record: AttendanceRecord) => {
        existingMap.set(record.profile_id, record.id);
        attendanceMap.set(record.profile_id, record.status === 'present');
      });

      setExistingAttendance(existingMap);
      setAttendance(attendanceMap);
    } catch (error: any) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    }
  };

  const toggleAttendance = (profileId: string) => {
    const newAttendance = new Map(attendance);
    newAttendance.set(profileId, !newAttendance.get(profileId));
    setAttendance(newAttendance);
  };

  const handleSave = async () => {
    if (!serviceId) return;

    try {
      setSaving(true);
      
      const updates = [];
      const inserts = [];
      const deletes = [];

      for (const [profileId, isPresent] of attendance.entries()) {
        const existingId = existingAttendance.get(profileId);

        if (existingId) {
          // Update existing record
          updates.push({
            id: existingId,
            status: isPresent ? 'present' : 'absent'
          });
        } else if (isPresent) {
          // Insert new record only if present
          inserts.push({
            profile_id: profileId,
            service_id: serviceId,
            status: 'present'
          });
        }
      }

      // Handle deletions (unmarked members who had records)
      for (const [profileId, recordId] of existingAttendance.entries()) {
        if (!attendance.get(profileId)) {
          deletes.push(recordId);
        }
      }

      // Execute updates
      if (updates.length > 0) {
        for (const update of updates) {
          const { error } = await supabase
            .from("attendance")
            .update({ status: update.status })
            .eq('id', update.id);

          if (error) throw error;
        }
      }

      // Execute inserts
      if (inserts.length > 0) {
        const { error } = await supabase
          .from("attendance")
          .insert(inserts);

        if (error) throw error;
      }

      // Execute deletes
      if (deletes.length > 0) {
        const { error } = await supabase
          .from("attendance")
          .delete()
          .in('id', deletes);

        if (error) throw error;
      }

      toast.success("Attendance saved successfully!");
      await loadData();
    } catch (error: any) {
      console.error("Error saving attendance:", error);
      toast.error("Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  const markAllPresent = () => {
    const newAttendance = new Map(attendance);
    filteredMembers.forEach(member => {
      newAttendance.set(member.id, true);
    });
    setAttendance(newAttendance);
  };

  const markAllAbsent = () => {
    const newAttendance = new Map(attendance);
    filteredMembers.forEach(member => {
      newAttendance.set(member.id, false);
    });
    setAttendance(newAttendance);
  };

  const handleAddPerson = async () => {
    if (!newPersonData.full_name.trim()) {
      toast.error("Please enter a name");
      return;
    }

    if (!newPersonData.email.trim()) {
      toast.error("Please enter an email");
      return;
    }

    try {
      // Generate member code if they're a new member
      const memberCode = newPersonData.status === "member" 
        ? `MEM-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`
        : null;

      // Create contact in contacts table
      const { data: newContact, error: contactError } = await supabase
        .from("contacts")
        .insert({
          full_name: newPersonData.full_name,
          email: newPersonData.email,
          phone: newPersonData.phone || null,
          member_code: memberCode,
          contact_type: newPersonData.status,
          is_active: true,
          first_visit_date: new Date().toISOString().split('T')[0],
          last_visit_date: new Date().toISOString().split('T')[0],
          visit_count: 1
        })
        .select()
        .single();

      if (contactError) throw contactError;

      // Add to attendance as contact
      if (serviceId) {
        const { error: attendanceError } = await supabase
          .from("attendance")
          .insert({
            contact_id: newContact.id,
            service_id: serviceId,
            status: 'present'
          });

        if (attendanceError) throw attendanceError;
      }

      // Reload data to refresh the list
      await loadData();

      // Close dialog and reset form
      setIsAddPersonDialogOpen(false);
      setNewPersonData({
        full_name: "",
        email: "",
        phone: "",
        status: "visitor"
      });

      toast.success(
        newPersonData.status === "member" 
          ? `New member added with code: ${memberCode}` 
          : "First-time visitor added successfully"
      );
    } catch (error: any) {
      console.error("Error adding person:", error);
      toast.error("Failed to add person: " + error.message);
    }
  };

  const filteredMembers = members.filter(member =>
    member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const presentCount = Array.from(attendance.values()).filter(v => v).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Service not found</p>
            <Button className="mt-4" onClick={() => navigate("/admin/events")}>
              Back to Events
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/admin/events")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Events
        </Button>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-2xl">{service.name}</CardTitle>
                <CardDescription className="mt-2">
                  <div className="space-y-1">
                    <p>{format(new Date(service.service_date), 'PPPP')}</p>
                    {service.location && <p>Location: {service.location}</p>}
                  </div>
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-lg px-4 py-2">
                <Users className="mr-2 h-5 w-5" />
                {presentCount} / {members.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex-1 w-full sm:w-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search members by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddPersonDialogOpen(true)}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Person
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/admin/attendance/${serviceId}/bulk-import`)}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Bulk Import
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={markAllPresent}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Mark All Present
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={markAllAbsent}
                >
                  Clear All
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving..." : "Save Attendance"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              {filteredMembers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No members found</p>
                </div>
              ) : (
                filteredMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <Checkbox
                        checked={attendance.get(member.id) || false}
                        onCheckedChange={() => toggleAttendance(member.id)}
                      />
                      <div>
                        <p className="font-medium">{member.full_name}</p>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                        {member.phone && (
                          <p className="text-sm text-muted-foreground">{member.phone}</p>
                        )}
                      </div>
                    </div>
                    {attendance.get(member.id) && (
                      <Badge className="bg-green-500">Present</Badge>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Person Dialog */}
      <Dialog open={isAddPersonDialogOpen} onOpenChange={setIsAddPersonDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Person</DialogTitle>
            <DialogDescription>
              Add a first-time visitor or new member to the attendance log.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                id="full_name"
                value={newPersonData.full_name}
                onChange={(e) => setNewPersonData(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="Enter full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={newPersonData.email}
                onChange={(e) => setNewPersonData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Enter email address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone (Optional)</Label>
              <Input
                id="phone"
                value={newPersonData.phone}
                onChange={(e) => setNewPersonData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="Enter phone number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select
                value={newPersonData.status}
                onValueChange={(value) => setNewPersonData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visitor">First-time Visitor</SelectItem>
                  <SelectItem value="member">New Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddPersonDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddPerson}>
              Add & Mark Present
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AttendanceLog;
