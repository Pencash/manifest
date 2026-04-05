import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import FundingAvailability from "@/components/FundingAvailability";
import { ServiceSelector } from "@/components/ServiceSelector";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { hasAdminAccess, type AppRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useFundingAvailability } from "@/hooks/useFundingAvailability";

interface ExpenseCategory {
  id: string;
  name: string;
  code: string;
}

const DESCRIPTION_WORD_LIMIT = 10;
const JUSTIFICATION_CHAR_LIMIT = 2000;

const countWords = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
};

export default function ExpenseRequest() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const isEditMode = Boolean(editId);

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentRole, setCurrentRole] = useState<AppRole | null>(null);
  const [requestDate, setRequestDate] = useState<Date>(new Date());
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
  const requestedAmount = Number.parseFloat(formData.amount) || 0;
  const descriptionWordCount = countWords(formData.description);
  const {
    data: fundingData,
    isLoading: isFundingLoading,
  } = useFundingAvailability({
    selectedCategoryId: formData.category_id || undefined,
    selectedServiceId: formData.service_id || undefined,
  });
  const availableFunds = fundingData?.availableFunds ?? 0;
  const hasSufficientFunding = requestedAmount <= 0 || availableFunds >= requestedAmount;

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      navigate("/admin/auth");
      return;
    }

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

    setCurrentRole(roleData.role as AppRole);
    loadData();
  };

  const loadData = async () => {
    try {
      const [categoriesRes] = await Promise.all([
        supabase.from("expense_categories").select("id, name, code").eq("is_active", true).order("name"),
      ]);

      if (categoriesRes.error) throw categoriesRes.error;
      setCategories(categoriesRes.data || []);

      // Load existing expense data if in edit mode
      if (editId) {
        const { data: expenseData, error: expenseError } = await supabase
          .from("expense_requests")
          .select("*")
          .eq("id", editId)
          .single();

        if (expenseError) throw expenseError;
        if (expenseData) {
          setFormData({
            category_id: expenseData.category_id,
            service_id: expenseData.service_id || "",
            amount: String(expenseData.amount),
            description: expenseData.description,
            justification: expenseData.justification,
            priority: expenseData.priority,
          });
          if (expenseData.due_date) {
            setDueDate(new Date(expenseData.due_date));
          }
          setRequestDate(new Date(expenseData.created_at));
        }
      }
    } catch (error: any) {
      toast.error("Failed to load form data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent, isDraft: boolean) => {
    e.preventDefault();

    if (descriptionWordCount > DESCRIPTION_WORD_LIMIT) {
      toast.error(`Description must not exceed ${DESCRIPTION_WORD_LIMIT} words.`);
      return;
    }

    if (!isDraft) {
      if (isFundingLoading) {
        toast.error("Funding availability is still loading. Please wait and try again.");
        return;
      }

      if (!hasSufficientFunding) {
        toast.error(
          `Insufficient funds available for this request. Available: MWK ${availableFunds.toLocaleString()}.`
        );
        return;
      }
    }

    setSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      const requestTimestamp = new Date(requestDate);
      requestTimestamp.setHours(12, 0, 0, 0);

      const payload: Record<string, unknown> = {
        category_id: formData.category_id,
        service_id: formData.service_id || null,
        amount: parseFloat(formData.amount),
        description: formData.description.trim(),
        justification: formData.justification.trim(),
        priority: formData.priority,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
        status: isDraft ? "draft" : "pending",
      };

      if (isEditMode && editId) {
        const { error } = await supabase.from("expense_requests").update(payload as any).eq("id", editId);
        if (error) throw error;
        toast.success("Expense request updated successfully");
        navigate(`/admin/expenses/${editId}`);
      } else {
        payload.requester_id = user.id;
        if (currentRole === "finance") {
          payload.created_at = requestTimestamp.toISOString();
        }
        const { error } = await supabase.from("expense_requests").insert(payload as any);
        if (error) throw error;
        toast.success(isDraft ? "Draft saved successfully" : "Expense request submitted for approval");
        navigate("/admin/expenses/all");
      }
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
          <h1 className="text-3xl font-bold text-foreground">{isEditMode ? "Edit Expense Request" : "New Expense Request"}</h1>
          <p className="text-muted-foreground">{isEditMode ? "Update the expense request details" : "Submit an expense request for approval"}</p>
        </div>

        <FundingAvailability
          selectedCategoryId={formData.category_id}
          selectedServiceId={formData.service_id}
          requestedAmount={requestedAmount}
        />

        <Card>
          <CardHeader>
            <CardTitle>Expense Details</CardTitle>
            <CardDescription>
              Fill in the details for your expense request{currentRole === "finance" ? " and backdate it when needed." : "."}
            </CardDescription>
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
                    <p className="text-sm text-muted-foreground">Selected: {selectedServiceName}</p>
                  )}
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

                {currentRole === "finance" && (
                  <div className="space-y-2">
                    <Label>Request Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn("w-full justify-start text-left font-normal", !requestDate && "text-muted-foreground")}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {requestDate ? format(requestDate, "PPP") : "Pick a request date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={requestDate}
                          onSelect={(date) => date && setRequestDate(date)}
                          disabled={(date) => date > new Date()}
                          captionLayout="dropdown-buttons"
                          fromYear={new Date().getFullYear() - 10}
                          toYear={new Date().getFullYear()}
                          initialFocus
                          className="p-4 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground">Finance users can backdate requests, but future request dates are blocked.</p>
                  </div>
                )}

                <div className={cn("space-y-2", currentRole === "finance" ? "md:col-span-2" : "md:col-span-2")}>
                  <Label>Due Date (Optional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dueDate ? format(dueDate, "PPP") : "Pick a due date"}
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
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    if (countWords(nextValue) <= DESCRIPTION_WORD_LIMIT) {
                      setFormData({ ...formData, description: nextValue });
                    }
                  }}
                  placeholder="What is being purchased? (10 words max)"
                  rows={3}
                  required
                />
                <p className="text-xs text-muted-foreground text-right">
                  {descriptionWordCount}/{DESCRIPTION_WORD_LIMIT} words
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="justification">Justification *</Label>
                <Textarea
                  id="justification"
                  value={formData.justification}
                  onChange={(e) => setFormData({ ...formData, justification: e.target.value.slice(0, JUSTIFICATION_CHAR_LIMIT) })}
                  placeholder="Why is this expense needed?"
                  maxLength={JUSTIFICATION_CHAR_LIMIT}
                  rows={3}
                  required
                />
                <p className="text-xs text-muted-foreground text-right">
                  {formData.justification.length}/{JUSTIFICATION_CHAR_LIMIT}
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="button" variant="outline" onClick={(e) => handleSubmit(e as any, true)} disabled={submitting}>
                  Save as Draft
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || isFundingLoading || !hasSufficientFunding}
                  className="flex-1"
                >
                  {submitting ? "Submitting..." : "Submit for Approval"}
                </Button>
              </div>
              {!hasSufficientFunding && requestedAmount > 0 && (
                <p className="text-sm text-destructive">
                  This request cannot be raised because available funds are insufficient.
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
