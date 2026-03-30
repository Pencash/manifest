import { useState } from "react";
import { format, isSameDay } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { triggerNotificationRefresh } from "@/lib/notification-events";
import { cn, formatAmount } from "@/lib/utils";
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
import {
  createInitialOfflineForm,
  extractMissingGivingColumn,
  OFFLINE_GIVING_SCHEMA_OPTIONAL_COLUMNS,
  useGivingsAuth,
  useGivingsMetadata,
} from "@/hooks/useGivingsData";

export default function FinancialOfflineGiving() {
  const { currentRole, loading: authLoading } = useGivingsAuth();
  const { givingTypes, members, events, loadingMembers } = useGivingsMetadata();

  const [offlineForm, setOfflineForm] = useState(createInitialOfflineForm());
  const [editingGivingId, setEditingGivingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => { setOfflineForm(createInitialOfflineForm()); setEditingGivingId(null); };

  const formatAmountWithSeparators = (value: string) => {
    const n = parseFloat(value.replace(/,/g, ""));
    if (isNaN(n)) return value.replace(/,/g, "");
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleAmountBlur = () => {
    if (!offlineForm.amount) return;
    setOfflineForm((prev) => ({ ...prev, amount: formatAmountWithSeparators(prev.amount) }));
  };

  const handleAmountFocus = () => {
    setOfflineForm((prev) => ({ ...prev, amount: prev.amount.replace(/,/g, "") }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offlineForm.memberId) { toast.error("Please select a registered member"); return; }
    if (!offlineForm.givingTypeId) { toast.error("Please select a purpose of giving"); return; }
    const amountValue = parseFloat(offlineForm.amount.replace(/,/g, ""));
    if (isNaN(amountValue) || amountValue <= 0) { toast.error("Please enter a valid amount"); return; }
    if (!offlineForm.paymentMethod) { toast.error("Please select a mode of giving"); return; }
    if ((offlineForm.paymentMethod === "mobile_money" || offlineForm.paymentMethod === "bank_transfer") && (!offlineForm.paymentReference || offlineForm.paymentReference.length < 4)) {
      toast.error("Payment reference is required for mobile money or bank transfers"); return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
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
      let usedLegacyFallback = false;

      for (let attempt = 0; attempt <= OFFLINE_GIVING_SCHEMA_OPTIONAL_COLUMNS.length; attempt += 1) {
        if (editingGivingId) {
          const { error } = await supabase.from("givings").update(payloadToSave).eq("id", editingGivingId);
          saveError = error;
        } else {
          const { error } = await supabase.from("givings").insert(payloadToSave as any);
          saveError = error;
        }
        if (!saveError) break;
        const missingCol = extractMissingGivingColumn(saveError);
        if (!missingCol || !(missingCol in payloadToSave)) throw saveError;
        delete payloadToSave[missingCol];
        usedLegacyFallback = true;
      }
      if (saveError) throw saveError;

      if (usedLegacyFallback) {
        toast.warning("Saved with legacy fields. Apply latest migrations for full workflow.");
      }

      const actionLabel = editingGivingId ? "updated" : "recorded";
      const suffix = isFinanceOfflineRecord && !usedLegacyFallback ? " — sent for admin verification" : "";
      toast.success(`Offline giving ${actionLabel}${suffix}`);
      console.info(`[telemetry] offline_giving_${actionLabel}`, { role: currentRole });

      resetForm();
      triggerNotificationRefresh();
    } catch (err: any) {
      console.error("[telemetry] offline_giving_failed", err);
      toast.error(err.message || "Failed to record giving");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  }

  const dateMatchedEvents = events.filter((ev) => isSameDay(new Date(ev.service_date), offlineForm.receivedDate));
  const prioritizedEvents = [...dateMatchedEvents, ...events.filter((ev) => !dateMatchedEvents.some((m) => m.id === ev.id))];
  const selectedEvent = events.find((ev) => ev.id === offlineForm.serviceId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display">{editingGivingId ? "Edit Offline Giving" : "Record Offline Giving"}</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Capture cash or manual contributions for members without app access.
          {currentRole === "finance" ? " Finance-recorded offline givings stay pending until an admin verifies them." : ""}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>{editingGivingId ? "Edit Giving" : "New Offline Giving"}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="member">Member *</Label>
                <Select value={offlineForm.memberId} onValueChange={(v) => setOfflineForm({ ...offlineForm, memberId: v })} disabled={loadingMembers || submitting}>
                  <SelectTrigger id="member"><SelectValue placeholder={loadingMembers ? "Loading members..." : "Select registered member"} /></SelectTrigger>
                  <SelectContent>
                    {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name} {m.email ? `(${m.email})` : ""}</SelectItem>)}
                    {!members.length && !loadingMembers && <SelectItem value="no-members" disabled>No registered members found</SelectItem>}
                  </SelectContent>
                </Select>
                {offlineForm.memberId && (
                  <p className="text-xs text-muted-foreground">
                    {members.find((m) => m.id === offlineForm.memberId)?.email || "No email"} | {members.find((m) => m.id === offlineForm.memberId)?.phone || "No phone"}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="givingType">Purpose of Giving *</Label>
                <Select value={offlineForm.givingTypeId} onValueChange={(v) => setOfflineForm({ ...offlineForm, givingTypeId: v })}>
                  <SelectTrigger id="givingType"><SelectValue placeholder="Select purpose" /></SelectTrigger>
                  <SelectContent>{givingTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input id="amount" type="text" value={offlineForm.amount} onChange={(e) => setOfflineForm({ ...offlineForm, amount: e.target.value })} onBlur={handleAmountBlur} onFocus={handleAmountFocus} placeholder="0.00" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input id="currency" value={offlineForm.currency} onChange={(e) => setOfflineForm({ ...offlineForm, currency: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Mode of Giving *</Label>
                <Select value={offlineForm.paymentMethod} onValueChange={(v) => setOfflineForm({ ...offlineForm, paymentMethod: v })}>
                  <SelectTrigger id="paymentMethod"><SelectValue placeholder="Select mode" /></SelectTrigger>
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
                      <CalendarIcon className="mr-2 h-4 w-4" />{format(offlineForm.receivedDate, "PPP")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={offlineForm.receivedDate} onSelect={(d) => d && setOfflineForm({ ...offlineForm, receivedDate: d })} initialFocus captionLayout="dropdown-buttons" fromYear={new Date().getFullYear() - 10} toYear={new Date().getFullYear() + 10} className="p-4 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="relatedEvent">Related Event (Optional)</Label>
                <Select value={offlineForm.serviceId || "none"} onValueChange={(v) => setOfflineForm({ ...offlineForm, serviceId: v === "none" ? "" : v })}>
                  <SelectTrigger id="relatedEvent"><SelectValue placeholder="Link to an event" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No related event</SelectItem>
                    {prioritizedEvents.map((ev) => <SelectItem key={ev.id} value={ev.id}>{ev.name} — {format(new Date(ev.service_date), "PPP")}{ev.is_archived ? " (Archived)" : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
                {dateMatchedEvents.length > 0 && <p className="text-xs text-muted-foreground">{dateMatchedEvents.length} event(s) match the selected date.</p>}
                {selectedEvent && !isSameDay(new Date(selectedEvent.service_date), offlineForm.receivedDate) && <p className="text-xs text-muted-foreground">Event date: {format(new Date(selectedEvent.service_date), "PPP")}</p>}
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="paymentReference">Payment Reference</Label>
                <Input id="paymentReference" value={offlineForm.paymentReference} onChange={(e) => setOfflineForm({ ...offlineForm, paymentReference: e.target.value })} placeholder="Txn code or receipt number" />
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
              <Textarea id="note" value={offlineForm.note} onChange={(e) => setOfflineForm({ ...offlineForm, note: e.target.value })} placeholder="Add any helpful details about this giving" rows={3} />
            </div>

            <div className="flex justify-end gap-2">
              {editingGivingId && <Button type="button" variant="outline" onClick={resetForm}>Cancel Edit</Button>}
              <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : editingGivingId ? "Update Giving" : "Record Giving"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
