import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { hasAdminAccess } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Upload } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import FundingAvailability from "@/components/FundingAvailability";
import { ServiceSelector } from "@/components/ServiceSelector";

interface ExpenseCategory {
  id: string;
  name: string;
  code: string;
}

interface Service {
  id: string;
  name: string;
  service_date: string;
}

export default function ExpenseRequest() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [dueDate, setDueDate] = useState<Date>();
  const [selectedServiceName, setSelectedServiceName] = useState("");
  const [formData, setFormData] = useState({
    category_id: "",
    service_id: "",
    amount: "",
    description: "",
    justification: "",
    priority: "medium",
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/admin/auth");
      return;
    }

    // Check admin access
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .single();

    if (!roleData || !hasAdminAccess(roleData.role)) {
      toast.error("Access denied. Only administrators can create expense requests.");
      navigate("/dashboard");
      return;
    }

    loadData();
  };

  const loadData = async () => {
    try {
      const [categoriesRes, servicesRes] = await Promise.all([
        supabase.from("expense_categories").select("id, name, code").eq("is_active", true).order("name"),
        supabase.from("services").select("id, name, service_date").eq("is_published", true).order("service_date", { ascending: false }).limit(20)
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      if (servicesRes.error) throw servicesRes.error;

      setCategories(categoriesRes.data || []);
      setServices(servicesRes.data || []);
    } catch (error: any) {
      toast.error("Failed to load form data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent, isDraft: boolean) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("expense_requests").insert({
        requester_id: user.id,
        category_id: formData.category_id,
        service_id: formData.service_id || null,
        amount: parseFloat(formData.amount),
        description: formData.description.trim(),
        justification: formData.justification.trim(),
        priority: formData.priority,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
        status: isDraft ? "draft" : "pending",
      });

      if (error) throw error;

      toast.success(isDraft ? "Draft saved successfully" : "Expense request submitted for approval");
      navigate("/admin/expenses/all");
    } catch (error: any) {
      toast.error(error.message || "Failed to submit request");
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
         <div>
          <h1 className="text-3xl font-bold text-foreground">New Expense Request</h1>
          <p className="text-muted-foreground">Submit an expense request for approval</p>
        </div>

        <FundingAvailability 
          selectedCategoryId={formData.category_id}
          selectedServiceId={formData.service_id}
          requestedAmount={parseFloat(formData.amount) || 0}
        />

        <Card>
          <CardHeader>
            <CardTitle>Expense Details</CardTitle>
            <CardDescription>Fill in the details for your expense request</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="category">Expense Category *</Label>
                  <Select value={formData.category_id} onValueChange={(value) => setFormData({ ...formData, category_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.code} - {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Link to Service/Event (Optional)</Label>
                  <ServiceSelector
                    onServiceSelect={(serviceId, serviceName) => {
                      setFormData({ ...formData, service_id: serviceId });
                      setSelectedServiceName(serviceName);
                    }}
                    selectedServiceId={formData.service_id}
                  />
                  {formData.service_id && selectedServiceName && (
                    <p className="text-sm text-muted-foreground">
                      Selected: {selectedServiceName}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (MWK) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority *</Label>
                  <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Due Date (Optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dueDate ? format(dueDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value.slice(0, 2000) })}
                  placeholder="What is being purchased?"
                  maxLength={2000}
                  rows={3}
                  required
                />
                <p className="text-xs text-muted-foreground text-right">{formData.description.length}/2000</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="justification">Justification *</Label>
                <Textarea
                  id="justification"
                  value={formData.justification}
                  onChange={(e) => setFormData({ ...formData, justification: e.target.value.slice(0, 2000) })}
                  placeholder="Why is this expense needed?"
                  maxLength={2000}
                  rows={3}
                  required
                />
                <p className="text-xs text-muted-foreground text-right">{formData.justification.length}/2000</p>
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="button" variant="outline" onClick={(e) => handleSubmit(e as any, true)} disabled={submitting}>
                  Save as Draft
                </Button>
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? "Submitting..." : "Submit for Approval"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
