import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  FileClock,
  FolderOpen,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import { useExpenseRequestDetail } from "@/hooks/useExpenseRequestDetail";
import { cn, formatAmount } from "@/lib/utils";
import {
  currencySafe,
  formatDateOnly,
  formatDateTime,
  formatMethodLabel,
  statusBadgeClasses,
  priorityBadgeClasses,
} from "@/lib/expense-format";
import type { PaymentRecord } from "@/lib/expense-detail-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

import { EmptyState } from "@/components/expense/EmptyState";
import { ExpenseRequestSummaryCard } from "@/components/expense/ExpenseRequestSummaryCard";
import { ExpenseApprovalTimeline } from "@/components/expense/ExpenseApprovalTimeline";
import { ExpensePaymentLedger } from "@/components/expense/ExpensePaymentLedger";
import { RecordExpensePaymentDialog, type PaymentFormState } from "@/components/expense/RecordExpensePaymentDialog";
import { VoidExpensePaymentDialog } from "@/components/expense/VoidExpensePaymentDialog";
import { ExpenseAttachmentsPanel } from "@/components/expense/ExpenseAttachmentsPanel";

export default function AdminExpenseRequestDetails() {
  const navigate = useNavigate();
  const { expenseId } = useParams<{ expenseId: string }>();

  const {
    loading, refreshing, expense,
    requesterProfile, paidByProfile,
    approvals, payments, receipts, profilesMap,
    postedTotal, requestedAmount, remainingBalance,
    paymentProgress, derivedPaymentStatus,
    latestPostedPayment, canManagePayments, canRecordPayment,
    checkAuthAndLoad, loadExpenseDetail,
    recordPayment, voidPayment, openReceipt,
  } = useExpenseRequestDetail(expenseId);

  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [paymentToVoid, setPaymentToVoid] = useState<PaymentRecord | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [voidingPayment, setVoidingPayment] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>({
    amount: "",
    payment_method: "bank_transfer",
    payment_reference: "",
    payee_name: "",
    payment_date: new Date().toISOString().slice(0, 16),
    notes: "",
  });

  useEffect(() => {
    void checkAuthAndLoad();
  }, [expenseId]);

  const handleOpenRecordDialog = () => {
    setPaymentForm({
      amount: remainingBalance > 0 ? remainingBalance.toString() : expense?.amount?.toString() || "",
      payment_method: "bank_transfer",
      payment_reference: "",
      payee_name: "",
      payment_date: new Date().toISOString().slice(0, 16),
      notes: "",
    });
    setRecordDialogOpen(true);
  };

  const handleRecordPayment = async () => {
    try {
      setSubmittingPayment(true);
      await recordPayment(paymentForm);
      toast.success("Payment recorded successfully.");
      setRecordDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to record payment");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleOpenVoidDialog = (payment: PaymentRecord) => {
    setPaymentToVoid(payment);
    setVoidReason("");
    setVoidDialogOpen(true);
  };

  const handleVoidPayment = async () => {
    if (!paymentToVoid) return;
    try {
      setVoidingPayment(true);
      await voidPayment(paymentToVoid, voidReason);
      toast.success("Payment voided successfully.");
      setVoidDialogOpen(false);
      setPaymentToVoid(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to void payment");
    } finally {
      setVoidingPayment(false);
    }
  };

  const handleOpenReceipt = async (receipt: any) => {
    try {
      await openReceipt(receipt);
    } catch (error: any) {
      toast.error(error.message || "Failed to open receipt");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading expense workspace...</p>
        </div>
      </div>
    );
  }

  if (!expense) {
    return (
      <div className="container mx-auto py-10">
        <EmptyState icon={FileClock} title="Expense request not found" description="The selected expense may have been deleted or you may no longer have access to it." />
      </div>
    );
  }

  const postedPaymentCount = payments.filter((p) => p.status === "posted").length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <Button variant="ghost" className="w-fit" onClick={() => navigate("/admin/expenses/all")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to all expenses
            </Button>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className={cn("border", statusBadgeClasses[expense.status] || statusBadgeClasses.draft)}>
                  {expense.status.replace(/_/g, " ").toUpperCase()}
                </Badge>
                <Badge className={cn("border", priorityBadgeClasses[expense.priority] || priorityBadgeClasses.medium)}>
                  {expense.priority.toUpperCase()} priority
                </Badge>
                <Badge variant="outline" className="font-mono text-xs">
                  {expense.request_number || "Draft Request"}
                </Badge>
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">{expense.description}</h1>
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                  A complete view of request details, approval decisions, payment progress, and attached proof.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => void loadExpenseDetail()} disabled={refreshing}>
              <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
              Refresh
            </Button>
            {canRecordPayment && (
              <Button onClick={handleOpenRecordDialog}>
                <Wallet className="mr-2 h-4 w-4" />
                Record payment
              </Button>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <ExpenseRequestSummaryCard
          expense={expense}
          postedTotal={postedTotal}
          remainingBalance={remainingBalance}
          derivedPaymentStatus={derivedPaymentStatus}
          postedPaymentCount={postedPaymentCount}
          latestPostedPayment={latestPostedPayment}
        />

        {/* Payment progress */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Payment progress</CardTitle>
                <CardDescription>The payment ledger below drives the current disbursement state for this request.</CardDescription>
              </div>
              <Badge className={cn("border", statusBadgeClasses[derivedPaymentStatus] || statusBadgeClasses.approved)}>
                {derivedPaymentStatus.replace(/_/g, " ").toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={paymentProgress} className="h-3" />
            <div className="flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
              <span>{formatAmount(postedTotal, currencySafe(expense.currency))} of {formatAmount(requestedAmount, currencySafe(expense.currency))} has been disbursed.</span>
              <span>{paymentProgress.toFixed(1)}% complete</span>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 md:grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="attachments">Attachments</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Request narrative</CardTitle>
                  <CardDescription>What was requested and why it was justified.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Description</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{expense.description}</p>
                  </div>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Justification</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{expense.justification}</p>
                  </div>
                  {expense.rejection_reason && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-destructive">Latest rejection reason</h3>
                        <p className="mt-2 whitespace-pre-wrap rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm leading-6 text-foreground">
                          {expense.rejection_reason}
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Ownership & routing</CardTitle>
                    <CardDescription>Who owns the request and where it belongs.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="font-medium">Requester</p>
                        <p>{requesterProfile?.full_name || "Unknown user"}</p>
                        <p className="text-muted-foreground">{requesterProfile?.email || "No email available"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <FolderOpen className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="font-medium">Category</p>
                        <p>{expense.expense_categories?.name || "Unknown category"}</p>
                        <p className="text-muted-foreground">{expense.expense_categories?.code || "No category code"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CalendarDays className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="font-medium">Service / event</p>
                        <p>{expense.services?.name || "General expense"}</p>
                        <p className="text-muted-foreground">{expense.services?.service_date ? formatDateOnly(expense.services.service_date) : "Not tied to a service"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Workflow metadata</CardTitle>
                    <CardDescription>Operational facts for finance and approvers.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Current status</span>
                      <span className="font-medium">{expense.status.replace(/_/g, " ")}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Due date</span>
                      <span className="font-medium">{formatDateOnly(expense.due_date)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Created</span>
                      <span className="font-medium">{formatDateTime(expense.created_at)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Last updated</span>
                      <span className="font-medium">{formatDateTime(expense.updated_at)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Latest payment method</span>
                      <span className="font-medium">{formatMethodLabel(expense.payment_method)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Latest payment reference</span>
                      <span className="font-medium">{expense.payment_reference || "—"}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Latest paid at</span>
                      <span className="font-medium">{formatDateTime(expense.paid_at)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Recorded by</span>
                      <span className="font-medium">{paidByProfile?.full_name || "—"}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="approvals">
            <ExpenseApprovalTimeline approvals={approvals} profilesMap={profilesMap} />
          </TabsContent>

          <TabsContent value="payments">
            <ExpensePaymentLedger
              payments={payments}
              profilesMap={profilesMap}
              currency={expense.currency}
              canRecordPayment={canRecordPayment}
              canManagePayments={canManagePayments}
              onRecordPayment={handleOpenRecordDialog}
              onVoidPayment={handleOpenVoidDialog}
            />
          </TabsContent>

          <TabsContent value="attachments">
            <ExpenseAttachmentsPanel receipts={receipts} profilesMap={profilesMap} onOpenReceipt={handleOpenReceipt} />
          </TabsContent>
        </Tabs>
      </div>

      <RecordExpensePaymentDialog
        open={recordDialogOpen}
        onOpenChange={setRecordDialogOpen}
        form={paymentForm}
        onFormChange={setPaymentForm}
        remainingBalance={remainingBalance}
        currency={currencySafe(expense.currency)}
        submitting={submittingPayment}
        onSubmit={() => void handleRecordPayment()}
      />

      <VoidExpensePaymentDialog
        open={voidDialogOpen}
        onOpenChange={setVoidDialogOpen}
        payment={paymentToVoid}
        currency={expense.currency}
        voidReason={voidReason}
        onVoidReasonChange={setVoidReason}
        voiding={voidingPayment}
        onConfirm={() => void handleVoidPayment()}
      />
    </div>
  );
}
