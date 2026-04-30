import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Upload, Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { getHighestRole, hasAdminAccess } from "@/lib/roles";
import { useEffect } from "react";
import { User } from "@supabase/supabase-js";

interface Service {
  id: string;
  name: string;
  service_type: string;
  service_date: string;
  location: string | null;
}

const BulkAttendanceImport = () => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate("/admin/auth");
        return;
      }

      setUser(session.user);

      // Load ALL roles for this user (NOT single)
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

      // Load service details for snapshot data
      if (serviceId) {
        const { data: serviceData } = await supabase
          .from("services")
          .select("id, name, service_type, service_date, location")
          .eq("id", serviceId)
          .single();
        
        setService(serviceData);
      }

      setLoading(false);
    } catch (error: any) {
      console.error("Error:", error);
      toast.error("Failed to verify access");
    }
  };

  const downloadTemplate = () => {
    const template = [
      { full_name: "John Doe", email: "john@example.com", phone: "+265999123456", status: "present" },
      { full_name: "Jane Smith", email: "", phone: "+265888654321", status: "present" }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, "attendance_template.xlsx");
    toast.success("Template downloaded successfully");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !serviceId) return;

    try {
      setImporting(true);
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as Array<{
            full_name: string;
            email?: string;
            phone?: string;
            status: string;
          }>;

          let successCount = 0;
          let errorCount = 0;

          for (const row of jsonData) {
            try {
              if (!row.full_name?.trim()) {
                errorCount++;
                continue;
              }
              const normalizedEmail = row.email?.trim() || null;
              const normalizedPhone = row.phone?.trim() || null;
              const attendanceStatus = row.status || "present";
              let imported = false;

              if (normalizedEmail) {
                // Check if person exists in profiles by email
                const { data: existingProfile } = await supabase
                  .from("profiles")
                  .select("id")
                  .eq("email", normalizedEmail)
                  .maybeSingle();

                if (existingProfile) {
                  const { error } = await supabase
                    .from("attendance")
                    .insert({
                      profile_id: existingProfile.id,
                      service_id: serviceId,
                      status: attendanceStatus,
                      snapshot_event_name: service?.name || null,
                      snapshot_event_date: service?.service_date || null,
                      snapshot_event_venue: service?.location || null,
                      snapshot_event_type: service?.service_type || null,
                      snapshot_person_name: row.full_name,
                      snapshot_person_email: normalizedEmail,
                      snapshot_person_phone: normalizedPhone,
                      created_by: user?.id || null,
                    });
                  if (!error) {
                    successCount++;
                    imported = true;
                  }
                }
              }

              if (!imported) {
                // Check if contact exists by email first (if provided)
                const existingContactByEmail = normalizedEmail
                  ? await supabase.from("contacts").select("id").eq("email", normalizedEmail).maybeSingle()
                  : { data: null, error: null };

                if (existingContactByEmail.error) {
                  errorCount++;
                  continue;
                }

                const existingContactByPhone = !existingContactByEmail.data && normalizedPhone
                  ? await supabase.from("contacts").select("id").eq("phone", normalizedPhone).eq("full_name", row.full_name).maybeSingle()
                  : { data: null, error: null };

                if (existingContactByPhone.error) {
                  errorCount++;
                  continue;
                }

                const existingContact = existingContactByEmail.data || existingContactByPhone.data;
                if (existingContact) {
                  const { error } = await supabase
                    .from("attendance")
                    .insert({
                      contact_id: existingContact.id,
                      service_id: serviceId,
                      status: attendanceStatus,
                      snapshot_event_name: service?.name || null,
                      snapshot_event_date: service?.service_date || null,
                      snapshot_event_venue: service?.location || null,
                      snapshot_event_type: service?.service_type || null,
                      snapshot_person_name: row.full_name,
                      snapshot_person_email: normalizedEmail,
                      snapshot_person_phone: normalizedPhone,
                      created_by: user?.id || null,
                    });

                  if (!error) {
                    successCount++;
                    imported = true;
                  } else {
                    errorCount++;
                  }
                } else {
                  const { data: newContact, error: contactError } = await supabase
                    .from("contacts")
                    .insert({
                      full_name: row.full_name,
                      email: normalizedEmail,
                      phone: normalizedPhone,
                      contact_type: 'visitor',
                      first_visit_date: new Date().toISOString().split('T')[0],
                      last_visit_date: new Date().toISOString().split('T')[0],
                      visit_count: 1
                    })
                    .select()
                    .single();

                  if (contactError) {
                    errorCount++;
                    continue;
                  }

                  const { error: attendanceError } = await supabase
                    .from("attendance")
                    .insert({
                      contact_id: newContact.id,
                      service_id: serviceId,
                      status: attendanceStatus,
                      snapshot_event_name: service?.name || null,
                      snapshot_event_date: service?.service_date || null,
                      snapshot_event_venue: service?.location || null,
                      snapshot_event_type: service?.service_type || null,
                      snapshot_person_name: row.full_name,
                      snapshot_person_email: normalizedEmail,
                      snapshot_person_phone: normalizedPhone,
                      created_by: user?.id || null,
                    });

                  if (!attendanceError) successCount++;
                  else errorCount++;
                }
              }
            } catch (error) {
              console.error("Error processing row:", error);
              errorCount++;
            }
          }

          if (successCount > 0) {
            toast.success(`Successfully imported ${successCount} attendance records`);
          }
          if (errorCount > 0) {
            toast.error(`Failed to import ${errorCount} records`);
          }

          navigate(`/admin/attendance/${serviceId}`);
        } catch (error: any) {
          console.error("Error parsing file:", error);
          toast.error("Failed to parse file");
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (error: any) {
      console.error("Error uploading file:", error);
      toast.error("Failed to upload file");
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate(`/admin/attendance/${serviceId}`)}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Attendance
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-6 w-6" />
              Bulk Attendance Import
            </CardTitle>
            <CardDescription>
              Upload an Excel file to import multiple attendance records at once
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h3 className="font-semibold">Instructions:</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Download the template file below</li>
                <li>Fill in the attendance data (full_name, phone, status). Email is optional.</li>
                <li>Status should be "present" or "absent"</li>
                <li>Upload the completed file</li>
              </ol>
            </div>

            <div className="flex gap-4">
              <Button onClick={downloadTemplate} variant="outline" className="flex-1">
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>
            </div>

            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Select an Excel file to upload
              </p>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                disabled={importing}
                className="max-w-xs mx-auto"
              />
              {importing && (
                <p className="text-sm text-muted-foreground mt-4">
                  Importing... Please wait
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BulkAttendanceImport;
