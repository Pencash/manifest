import { useEffect, useMemo, useState } from "react";
import { format, startOfMonth } from "date-fns";
import { AlertTriangle, Ban, CheckCircle2, Landmark, Plus, ReceiptText, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useGivingsAuth } from "@/hooks/useGivingsData";
import { triggerNotificationRefresh } from "@/lib/notification-events";
import { buildRestrictedFundMonths, summarizeRestrictedFunds, type RestrictedFundMonth, type RestrictedRemittanceRow } from "@/lib/restricted-funds";
import { formatAmount } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const statusLabels: Record<string, string> = {
  cleared: "Cleared",
  partial: "Partial",
  pending: "Pending",
  overdue: "Overdue",
  no_funds: "No funds",
};

const statusClasses: Record<string, string> = {
  cleared: "border-primary/30 bg-primary/10 text-primary",
  partial: "border-accent/40 bg-accent/10 text-accent-foreground",
  pending: "border-muted-foreground/30 bg-muted text-muted-foreground",
  overdue: "border-destructive/40 bg-destructive/10 text-destructive",
  no_funds: "border-muted bg-muted text-muted-foreground",
};

const initialForm = {
  amount: "",
  remittedAt: format(new Date(), "yyyy-MM-dd"),
  paymentMethod: "bank_transfer",
  paymentReference: "",
  notes: "",
};

export default function RestrictedRemittances() {
  const { currentUserId, currentRole, loading: authLoading } = useGivingsAuth();
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState<RestrictedFundMonth[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<RestrictedFundMonth | null>(null);
  const [remitDialogOpen, setRemitDialogOpen] = useState(false);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [remittanceToVoid, setRemittanceToVoid] = useState<RestrictedRemittanceRow | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const canRecord = currentRole === "admin" || currentRole === "finance";
  const canVoid = currentRole === "admin";
  const summary = useMemo(() => summarizeRestrictedFunds(months), [months]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [givingsRes, remittancesRes] = await Promise.all([
        supabase.from("givings").select("amount, created_at, status, giving_types(name)").eq("status", "verified"),
        (supabase as any).from("restricted_fund_remittances").select("*").order("remittance_month", { ascending: false }),
      ]);

      if (givingsRes.error) throw givingsRes.error;
      if (remittancesRes.error) throw remittancesRes.error;

      const nextMonths = buildRestrictedFundMonths(givingsRes.data || [], remittancesRes.data || []);
      setMonths(nextMonths);
      setSelectedMonth((current) => current ? nextMonths.find((month) => month.monthKey === current.monthKey) || null : null);
    } catch (error: any) {
      console.error("Error loading restricted remittances:", error);
      toast.error("Failed to load restricted remittances");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) loadData();
  }, [authLoading]);

  const openRemitDialog = (month: RestrictedFundMonth) => {
    setSelectedMonth(month);
    setForm({ ...initialForm, amount: month.pending > 0 ? month.pending.toFixed(2) : "" });
    setRemitDialogOpen(true);
  };

  const recordRemittance = async () => {
    if (!selectedMonth || !currentUserId) return;
    const amount = Number(form.amount.replace(/,/g, ""));
    if (!amount || amount <= 0) { toast.error("Enter a valid remittance amount"); return; }
    if (amount > selectedMonth.pending) { toast.error("Amount cannot exceed the pending balance"); return; }
    if (["bank_transfer", "mobile_money"].includes(form.paymentMethod) && form.paymentReference.trim().length < 4) {
      toast.error("A reference is required for bank or mobile transfers");
      return;
    }

    try {
      setSaving(true);
      const { error } = await (supabase as any).from("restricted_fund_remittances").insert({
        remittance_month: selectedMonth.monthKey,
        amount,
        currency: "MWK",
        remitted_at: new Date(`${form.remittedAt}T12:00:00`).toISOString(),
        payment_method: form.paymentMethod,
        payment_reference: form.paymentReference.trim() || null,
        notes: form.notes.trim() || null,
        recorded_by: currentUserId,
        status: "posted",
      });
      if (error) throw error;
      toast.success("Restricted funds remittance recorded");
      setRemitDialogOpen(false);
      setForm(initialForm);
      await loadData();
      triggerNotificationRefresh();
    } catch (error: any) {
      console.error("Error recording remittance:", error);
      toast.error(error.message || "Failed to record remittance");
    } finally {
      setSaving(false);
    }
  };

  const voidRemittance = async () => {
    if (!remittanceToVoid || !currentUserId) return;
    if (voidReason.trim().length < 5) { toast.error("Add a clear void reason"); return; }
    try {
      setSaving(true);
      const { error } = await (supabase as any)
        .from("restricted_fund_remittances")
        .update({ status: "voided", voided_by: currentUserId, voided_at: new Date().toISOString(), void_reason: voidReason.trim() })
        .eq("id", remittanceToVoid.id);
      if (error) throw error;
      toast.success("Remittance voided");
      setVoidDialogOpen(false);
      setVoidReason("");
      setRemittanceToVoid(null);
      await loadData();
      triggerNotificationRefresh();
    } catch (error: any) {
      console.error("Error voiding remittance:", error);
      toast.error(error.message || "Failed to void remittance");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading restricted remittances...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display">Restricted Remittances</h1>
          <p className="text-sm text-muted-foreground mt-2">Track restricted funds forwarded to the mother church and clear month-end carryovers.</p>
        </div>
        {summary.oldestPending && canRecord && (
          <Button onClick={() => openRemitDialog(summary.oldestPending)}>
            <Plus className="mr-2 h-4 w-4" />Record oldest pending
          </Button>
        )}
      </div>

      {summary.totalPending > 0 ? (
        <Alert className="border-destructive/40 bg-destructive/5">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertDescription>
            <strong>{formatAmount(summary.totalPending)}</strong> is pending remittance across {summary.pendingMonthCount} month{summary.pendingMonthCount === 1 ? "" : "s"}.
            {summary.oldestPending ? ` Oldest pending month: ${summary.oldestPending.monthLabel}.` : ""}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-primary/30 bg-primary/5">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <AlertDescription>All restricted funds are remitted. Current pending balance is {formatAmount(0)}.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Restricted Collected</CardTitle></CardHeader><CardContent><p className="text-2xl font-mono font-bold">{formatAmount(summary.totalCollected)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Remitted</CardTitle></CardHeader><CardContent><p className="text-2xl font-mono font-bold text-primary">{formatAmount(summary.totalRemitted)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pending</CardTitle></CardHeader><CardContent><p className="text-2xl font-mono font-bold text-destructive">{formatAmount(summary.totalPending)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Overdue Carryover</CardTitle></CardHeader><CardContent><p className="text-2xl font-mono font-bold">{summary.overdueMonthCount}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Landmark className="h-5 w-5 text-accent" />Monthly restricted fund ledger</CardTitle>
          <CardDescription>Each month should close with zero pending balance after remittance.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Collected</TableHead><TableHead>Remitted</TableHead><TableHead>Pending</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {months.map((month) => (
                <TableRow key={month.monthKey} className={month.pending > 0 ? "bg-muted/30" : ""}>
                  <TableCell className="font-medium">{month.monthLabel}</TableCell>
                  <TableCell>{formatAmount(month.collected)}</TableCell>
                  <TableCell>{formatAmount(month.remitted)}</TableCell>
                  <TableCell className={month.pending > 0 ? "font-semibold text-destructive" : "font-semibold text-primary"}>{formatAmount(month.pending)}</TableCell>
                  <TableCell><Badge variant="outline" className={statusClasses[month.status]}>{statusLabels[month.status]}</Badge></TableCell>
                  <TableCell className="text-right"><Button size="sm" variant={month.pending > 0 ? "default" : "outline"} onClick={() => month.pending > 0 && canRecord ? openRemitDialog(month) : setSelectedMonth(month)}>{month.pending > 0 && canRecord ? "Remit" : "View"}</Button></TableCell>
                </TableRow>
              ))}
              {months.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No restricted funds have been verified yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedMonth && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ReceiptText className="h-5 w-5 text-accent" />{selectedMonth.monthLabel} details</CardTitle>
            <CardDescription>{formatAmount(selectedMonth.pending)} pending from {formatAmount(selectedMonth.collected)} restricted funds collected.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="font-semibold">Breakdown by giving type</h3>
              {Object.entries(selectedMonth.breakdown).map(([name, amount]) => (
                <div key={name} className="flex items-center justify-between rounded-md border p-3"><span>{name}</span><span className="font-mono font-semibold">{formatAmount(amount)}</span></div>
              ))}
              {!Object.keys(selectedMonth.breakdown).length && <p className="text-sm text-muted-foreground">No restricted givings recorded for this month.</p>}
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold">Remittance history</h3>
              {selectedMonth.remittances.map((remittance) => (
                <div key={remittance.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="font-mono font-semibold">{formatAmount(Number(remittance.amount), remittance.currency)}</p><p className="text-xs text-muted-foreground">{format(new Date(remittance.remitted_at), "PPP")} · {remittance.payment_method.replace("_", " ")}</p></div>
                    <Badge variant={remittance.status === "posted" ? "default" : "secondary"}>{remittance.status}</Badge>
                  </div>
                  {remittance.payment_reference && <p className="text-xs text-muted-foreground">Reference: {remittance.payment_reference}</p>}
                  {remittance.notes && <p className="text-sm">{remittance.notes}</p>}
                  {remittance.status === "posted" && canVoid && <Button size="sm" variant="outline" onClick={() => { setRemittanceToVoid(remittance); setVoidDialogOpen(true); }}><Ban className="mr-2 h-4 w-4" />Void</Button>}
                </div>
              ))}
              {!selectedMonth.remittances.length && <p className="text-sm text-muted-foreground">No remittance has been recorded for this month.</p>}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={remitDialogOpen} onOpenChange={setRemitDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record restricted funds remittance</DialogTitle><DialogDescription>{selectedMonth?.monthLabel} pending balance: {selectedMonth ? formatAmount(selectedMonth.pending) : formatAmount(0)}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Amount</Label><Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div><div className="space-y-2"><Label>Remittance date</Label><Input type="date" value={form.remittedAt} onChange={(e) => setForm({ ...form, remittedAt: e.target.value })} /></div></div>
            <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Payment method</Label><Select value={form.paymentMethod} onValueChange={(value) => setForm({ ...form, paymentMethod: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bank_transfer">Bank transfer</SelectItem><SelectItem value="cash_deposit">Cash deposit</SelectItem><SelectItem value="mobile_money">Mobile money</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Reference</Label><Input value={form.paymentReference} onChange={(e) => setForm({ ...form, paymentReference: e.target.value })} placeholder="Transaction or deposit reference" /></div></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setRemitDialogOpen(false)}>Cancel</Button><Button onClick={recordRemittance} disabled={saving}>{saving ? "Saving..." : "Record remittance"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Void remittance</DialogTitle><DialogDescription>This keeps the audit trail but removes the amount from posted remittances.</DialogDescription></DialogHeader>
          <div className="space-y-2"><Label>Void reason</Label><Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} rows={3} placeholder="Explain why this remittance is being voided" /></div>
          <DialogFooter><Button variant="outline" onClick={() => setVoidDialogOpen(false)}>Cancel</Button><Button variant="destructive" onClick={voidRemittance} disabled={saving}><RotateCcw className="mr-2 h-4 w-4" />Void remittance</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}