import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, isSameDay } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { hasAdminAccess, type AppRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { triggerNotificationRefresh } from "@/lib/notification-events";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const createInitialOfflineForm = () => ({
  memberId: "",
  givingTypeId: "",
  amount: "",
  currency: "MWK",
  paymentMethod: "",
  paymentReference: "",
  receivedDate: new Date(),
  serviceId: "",
  note: "",
});

const OFFLINE_GIVING_SCHEMA_OPTIONAL_COLUMNS = ["entry_source", "recorded_by", "requires_admin_verification"] as const;

const extractMissingGivingColumn = (error: { message?: string; details?: string } | null) => {
  const errorText = `${error?.message || ""} ${error?.details || ""}`;
  const match = errorText.match(/Could not find the '([^']+)' column of 'givings' in the schema cache/i);

  if (!match) return null;

  const missingColumn = match[1];
  return OFFLINE_GIVING_SCHEMA_OPTIONAL_COLUMNS.includes(missingColumn as (typeof OFFLINE_GIVING_SCHEMA_OPTIONAL_COLUMNS)[number])
    ? missingColumn
    : null;
};

export default function AdminOfflineGiving() {
  const navigate = useNavigate();
  const [currentRole, setCurrentRole] = useState<AppRole | null>(null);
  const [givingTypes, setGivingTypes] = useState<{ id: string; name: string }[]>([]);
  const [members, setMembers] = useState<{ id: string; full_name: string; email: string | null; phone: string | null }[]>([]);
  const [events, setEvents] = useState<{ id: string; name: string; service_date: string; is_archived: boolean | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [submittingOffline, setSubmittingOffline] = useState(false);
  const [offlineForm, setOfflineForm] = useState(createInitialOfflineForm());

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
      toast.error("Access denied. Admin privileges required.");
      navigate("/dashboard");
      return;
    }

    setCurrentRole(roleData.role as AppRole);

    await Promise.all([loadMetadata(), loadMembers(), loadEvents()]);
    setLoading(false);
  };

  const loadMetadata = async () => {
    const { data, error } = await supabase.from("giving_types").select("id, name").eq("is_active", true).order("name");
    if (error) throw error;
    setGivingTypes(data || []);
  };

  const loadMembers = async () => {
    try {
      setLoadingMembers(true);
      const { data, error } = await supabase.from("profiles").select("id, full_name, email, phone").order("full_name", { ascending: true });
      if (error) throw error;
      setMembers(data || []);
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadEvents = async () => {
    const { data, error } = await supabase.from("services").select("id, name, service_date, is_archived").order("service_date", { ascending: false });
    if (error) throw error;
    setEvents(data || []);
  };

  const formatAmountWithSeparators = (value: string) => {
    const numericValue = parseFloat(value.replace(/,/g, ""));
    if (isNaN(numericValue)) return value.replace(/,/g, "");

    return numericValue.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleAmountBlur = () => {
    if (!offlineForm.amount) return;
    setOfflineForm((prev) => ({
      ...prev,
      amount: formatAmountWithSeparators(prev.amount),
    }));
  };

  const handleAmountFocus = () => {
    setOfflineForm((prev) => ({
      ...prev,
      amount: prev.amount.replace(/,/g, ""),
    }));
  };

  const handleOfflineGivingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!offlineForm.memberId) {
      toast.error("Please select a registered member");
      return;
    }

    if (!offlineForm.givingTypeId) {
      toast.error("Please select a purpose of giving");
      return;
    }

    const amountValue = parseFloat(offlineForm.amount.replace(/,/g, ""));
    if (isNaN(amountValue) || amountValue <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!offlineForm.paymentMethod) {
      toast.error("Please select a mode of giving");
      return;
    }

    if (
      (offlineForm.paymentMethod === "mobile_money" || offlineForm.paymentMethod === "bank_transfer") &&
      (!offlineForm.paymentReference || offlineForm.paymentReference.length < 4)
    ) {
      toast.error("Payment reference is required for mobile money or bank transfers");
      return;
    }

    setSubmittingOffline(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      const receivedAt = new Date(offlineForm.receivedDate);
      receivedAt.setHours(12, 0, 0, 0);

      const isFinanceOfflineRecord = currentRole === "finance";
      const payload: Record<string, string | number | boolean | null> = {
        profile_id: offlineForm.memberId,
        giving_type_id: offlineForm.givingTypeId,
        amount: amountValue,
        currency: offlineForm.currency,
        payment_method: offlineForm.paymentMethod,
        payment_reference: offlineForm.paymentReference || null,
        service_id: offlineForm.serviceId || null,
        note: offlineForm.note || null,
        created_at: receivedAt.toISOString(),
        status: isFinanceOfflineRecord ? "pending" : "verified",
        is_anonymous: false,
        entry_source: "offline",
        recorded_by: user.id,
        requires_admin_verification: isFinanceOfflineRecord,
        rejection_reason: null,
      };

      let saveError: { message?: string; details?: string } | null = null;
      const payloadToSave = { ...payload };
      let usedLegacySchemaFallback = false;

      for (let attempt = 0; attempt <= OFFLINE_GIVING_SCHEMA_OPTIONAL_COLUMNS.length; attempt += 1) {
        const { error: givingError } = await supabase.from("givings").insert(payloadToSave as any);
        saveError = givingError;

        if (!saveError) {
          break;
        }

        const missingColumn = extractMissingGivingColumn(saveError);
        if (!missingColumn || !(missingColumn in payloadToSave)) {
          throw saveError;
        }

        delete payloadToSave[missingColumn];
        usedLegacySchemaFallback = true;
      }

      if (saveError) {
        throw saveError;
      }

      if (usedLegacySchemaFallback) {
        toast.warning("Offline giving saved with legacy database fields. Apply the latest Supabase migrations to restore the full verification workflow.");
      }

      toast.success(
        isFinanceOfflineRecord && !usedLegacySchemaFallback
          ? "Offline giving recorded and sent for admin verification"
          : "Offline giving recorded successfully",
      );

      setOfflineForm(createInitialOfflineForm());
      triggerNotificationRefresh();
    } catch (error: any) {
      console.error("Error recording offline giving:", error);
      toast.error(error.message || "Failed to record giving");
    } finally {
      setSubmittingOffline(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const dateMatchedEvents = events.filter((event) => isSameDay(new Date(event.service_date), offlineForm.receivedDate));
  const prioritizedEvents = [...dateMatchedEvents, ...events.filter((event) => !dateMatchedEvents.some((matched) => matched.id === event.id))];
  const selectedEvent = events.find((event) => event.id === offlineForm.serviceId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Record Offline Giving</CardTitle>
          <p className="text-sm text-muted-foreground">
            Capture cash or manual contributions for members without app access.
            {currentRole === "finance" ? " Finance-recorded offline givings stay pending until an admin verifies them." : ""}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleOfflineGivingSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="member">Member *</Label>
                <Select
                  value={offlineForm.memberId}
                  onValueChange={(value) => setOfflineForm({ ...offlineForm, memberId: value })}
                  disabled={loadingMembers || submittingOffline}
                >
                  <SelectTrigger id="member">
                    <SelectValue placeholder={loadingMembers ? "Loading members..." : "Select registered member"} />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name} {member.email ? `(${member.email})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {offlineForm.memberId && (
                  <p className="text-xs text-muted-foreground">
                    Selected member contact: {members.find((m) => m.id === offlineForm.memberId)?.email || "No email"} |{" "}
                    {members.find((m) => m.id === offlineForm.memberId)?.phone || "No phone"}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="givingType">Purpose of Giving *</Label>
                <Select value={offlineForm.givingTypeId} onValueChange={(value) => setOfflineForm({ ...offlineForm, givingTypeId: value })}>
                  <SelectTrigger id="givingType">
                    <SelectValue placeholder="Select purpose" />
                  </SelectTrigger>
                  <SelectContent>
                    {givingTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="text"
                  value={offlineForm.amount}
                  onChange={(e) => setOfflineForm({ ...offlineForm, amount: e.target.value })}
                  onBlur={handleAmountBlur}
                  onFocus={handleAmountFocus}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input id="currency" value={offlineForm.currency} onChange={(e) => setOfflineForm({ ...offlineForm, currency: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Mode of Giving *</Label>
                <Select value={offlineForm.paymentMethod} onValueChange={(value) => setOfflineForm({ ...offlineForm, paymentMethod: value })}>
                  <SelectTrigger id="paymentMethod">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="card">Card / POS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date Received *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !offlineForm.receivedDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(offlineForm.receivedDate, "PPP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={offlineForm.receivedDate}
                      onSelect={(date) => date && setOfflineForm({ ...offlineForm, receivedDate: date })}
                      initialFocus
                      captionLayout="dropdown-buttons"
                      fromYear={new Date().getFullYear() - 10}
                      toYear={new Date().getFullYear() + 10}
                      className="p-4 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="relatedEvent">Related Event (Optional)</Label>
                <Select
                  value={offlineForm.serviceId || "none"}
                  onValueChange={(value) => setOfflineForm({ ...offlineForm, serviceId: value === "none" ? "" : value })}
                >
                  <SelectTrigger id="relatedEvent">
                    <SelectValue placeholder="Link to an event" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No related event</SelectItem>
                    {prioritizedEvents.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name} — {format(new Date(event.service_date), "PPP")}
                        {event.is_archived ? " (Archived)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {dateMatchedEvents.length > 0 && (
                  <p className="text-xs text-muted-foreground">{dateMatchedEvents.length} event(s) match the selected date and appear first.</p>
                )}
                {selectedEvent && !isSameDay(new Date(selectedEvent.service_date), offlineForm.receivedDate) && (
                  <p className="text-xs text-muted-foreground">Selected event date: {format(new Date(selectedEvent.service_date), "PPP")}</p>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="paymentReference">Payment Reference</Label>
                <Input
                  id="paymentReference"
                  value={offlineForm.paymentReference}
                  onChange={(e) => setOfflineForm({ ...offlineForm, paymentReference: e.target.value })}
                  placeholder="Txn code or receipt number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={members.find((m) => m.id === offlineForm.memberId)?.email || ""} readOnly placeholder="Member email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={members.find((m) => m.id === offlineForm.memberId)?.phone || ""} readOnly placeholder="Member phone" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Notes</Label>
              <Textarea
                id="note"
                value={offlineForm.note}
                onChange={(e) => setOfflineForm({ ...offlineForm, note: e.target.value })}
                placeholder="Add any helpful details about this giving"
                rows={3}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={submittingOffline}>
                {submittingOffline ? "Saving..." : "Record Giving"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
