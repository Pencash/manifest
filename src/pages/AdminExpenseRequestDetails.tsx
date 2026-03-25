import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileClock, RefreshCw, Wallet } from "lucide-react";

import { ExpenseApprovalsTimeline } from "@/components/expenses/ExpenseApprovalsTimeline";
import { ExpenseAttachmentsPanel } from "@/components/expenses/ExpenseAttachmentsPanel";
import { ExpenseEmptyState } from "@/components/expenses/ExpenseEmptyState";
import { ExpenseOverviewPanel } from "@/components/expenses/ExpenseOverviewPanel";
import { ExpensePaymentsPanel } from "@/components/expenses/ExpensePaymentsPanel";
import { ExpenseSummaryCards } from "@/components/expenses/ExpenseSummaryCards";
import { RecordExpensePaymentDialog } from "@/components/expenses/RecordExpensePaymentDialog";
import { VoidExpensePaymentDialog } from "@/components/expenses/VoidExpensePaymentDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { currencySafe, statusBadgeClasses, priorityBadgeClasses } from "@/features/expenses/presentation";
import type { ExpensePaymentFormValues, PaymentRecord } from "@/features/expenses/types";
import {
  useExpenseReceiptUrl,
  useExpenseRequestDetail,
  useRecordExpensePayment,
  useVoidExpensePayment,
} from "@/hooks/useExpenseRequestDetail";
import {
  calculatePostedPaymentsTotal,
  calculateRemainingBalance,
  derivePaymentAwareExpenseStatus,
  validateExpensePaymentInput,
} from "@/lib/expense-payments";
import { hasAdminAccess, type AppRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { triggerNotificationRefresh } from "@/lib/notification-events";
import { toast } from "sonner";

const formatDateTimeLocalInputValue = (value = new Date()): string => {
  const localDate = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
};

const buildDefaultPaymentForm = (fallbackAmount = ""): ExpensePaymentFormValues => ({
  amount: fallbackAmount,
  payment_method: "bank_transfer",
  payment_reference: "",
  payee_name: "",
  payment_date: formatDateTimeLocalInputValue(),
  notes: "",
});

export default function AdminExpenseRequestDetails() {
  const navigate = useNavigate();
  const { expenseId } = useParams<{ expenseId: string }>();
  const [loadingAccess, setLoadingAccess] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [paymentToVoid, setPaymentToVoid] = useState<PaymentRecord | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [paymentForm, setPaymentForm] = useState<ExpensePaymentFormValues>(buildDefaultPaymentForm());

  const checkAccess = useCallback(async () => {
    try {
      setLoadingAccess(true);
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

      setRole(roleData.role as AppRole);
    } catch (error: any) {
      toast.error(error.message || "Failed to validate access");
      navigate("/dashboard");
    } finally {
      setLoadingAccess(false);
    }
  }, [navigate]);

  useEffect(() => {
    void checkAccess();
  }, [checkAccess]);

  const detailQuery = useExpenseRequestDetail(expenseId, !loadingAccess);
  const recordPaymentMutation = useRecordExpensePayment(expenseId);
  const voidPaymentMutation = useVoidExpensePayment(expenseId);
  const receiptUrlMutation = useExpenseReceiptUrl();

  const detail = detailQuery.data;
  const expense = detail?.expense ?? null;
  const payments = useMemo(() => detail?.payments ?? [], [detail?.payments]);
  const postedTotal = useMemo(() => calculatePostedPaymentsTotal(payments), [payments]);
  const remainingBalance = expense ? calculateRemainingBalance(expense.amount, postedTotal) : 0;
  const derivedPaymentStatus = expense ? derivePaymentAwareExpenseStatus(expense.amount, postedTotal) : "approved";
  const paymentProgress = expense && expense.amount > 0 ? Math.min((postedTotal / expense.amount) * 100, 100) : 0;
  const latestPostedPayment = payments.find((payment) => payment.status === "posted") || null;
  const postedPaymentCount = payments.filter((payment) => payment.status === "posted").length;
  const canManagePayments = role === "admin" || role === "finance";
  const canRecordPayment = Boolean(expense && canManagePayments && ["approved", "partially_paid"].includes(expense.status));

  useEffect(() => {
    if (expense && !recordDialogOpen) {
      setPaymentForm(buildDefaultPaymentForm(remainingBalance > 0 ? remainingBalance.toString() : expense.amount.toString()));
    }
  }, [expense, remainingBalance, recordDialogOpen]);

  const openRecordDialog = () => {
    if (!expense) return;
    setPaymentForm(buildDefaultPaymentForm(remainingBalance > 0 ? remainingBalance.toString() : expense.amount.toString()));
    setRecordDialogOpen(true);
  };

  const handleRecordPayment = async () => {
    if (!expense) return;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      const amount = Number(paymentForm.amount);
      const paymentDate = new Date(paymentForm.payment_date);

      if (Number.isNaN(paymentDate.getTime())) {
        throw new Error("Please choose a valid payment date and time.");
      }

      const validationErrors = validateExpensePaymentInput({
        amount,
        remainingBalance,
        paymentMethod: paymentForm.payment_method,
        paymentReference: paymentForm.payment_reference,
        payeeName: paymentForm.payee_name,
      });

      if (validationErrors.length > 0) {
        throw new Error(validationErrors[0]);
      }

      await recordPaymentMutation.mutateAsync({
        expenseRequestId: expense.id,
        amount,
        paymentDateIso: paymentDate.toISOString(),
        paymentMethod: paymentForm.payment_method,
        paymentReference: paymentForm.payment_reference.trim() || null,
        payeeName: paymentForm.payee_name.trim() || null,
        notes: paymentForm.notes.trim() || null,
        recordedBy: user.id,
      });

      toast.success("Payment recorded successfully.");
      setRecordDialogOpen(false);
      triggerNotificationRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to record payment");
      console.error(error);
    }
  };

  const handleVoidPayment = async () => {
    if (!paymentToVoid) return;

    try {
      await voidPaymentMutation.mutateAsync({
        paymentId: paymentToVoid.id,
        existingNotes: paymentToVoid.notes,
        voidReason,
      });

      toast.success("Payment voided successfully.");
      setVoidDialogOpen(false);
      setPaymentToVoid(null);
      setVoidReason("");
      triggerNotificationRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to void payment");
      console.error(error);
    }
  };

  const handleOpenReceipt = async (storagePath: string) => {
    try {
      const signedUrl = await receiptUrlMutation.mutateAsync(storagePath);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      toast.error(error.message || "Failed to open receipt");
      console.error(error);
    }
  };

  if (loadingAccess || detailQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="text-center space-y-3">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading expense workspace...</p>
        </div>
      </div>
    );
  }

  if (detailQuery.isError) {
    return (
      <div className="container mx-auto py-10">
        <ExpenseEmptyState
          icon={FileClock}
          title="Unable to load expense request"
          description={detailQuery.error instanceof Error ? detailQuery.error.message : "Please refresh and try again."}
        />
      </div>
    );
  }

  if (!expense || !detail) {
    return (
      <div className="container mx-auto py-10">
        <ExpenseEmptyState
          icon={FileClock}
          title="Expense request not found"
          description="The selected expense may have been deleted or you may no longer have access to it."
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
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
            <Button variant="outline" onClick={() => detailQuery.refetch()} disabled={detailQuery.isFetching}>
              <RefreshCw className={cn("mr-2 h-4 w-4", detailQuery.isFetching && "animate-spin")} />
              Refresh
            </Button>
            {canRecordPayment && (
              <Button onClick={openRecordDialog}>
                <Wallet className="mr-2 h-4 w-4" />
                Record payment
              </Button>
            )}
          </div>
        </div>

        <ExpenseSummaryCards
          expense={expense}
          postedTotal={postedTotal}
          remainingBalance={remainingBalance}
          derivedPaymentStatus={derivedPaymentStatus}
          paymentProgress={paymentProgress}
          latestPostedPayment={latestPostedPayment}
          postedPaymentCount={postedPaymentCount}
          settledAt={expense.paid_at}
          settledByName={detail.paidByProfile?.full_name || null}
        />

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 md:grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="attachments">Attachments</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <ExpenseOverviewPanel
              expense={expense}
              requesterProfile={detail.requesterProfile}
              paidByProfile={detail.paidByProfile}
            />
          </TabsContent>
          <TabsContent value="approvals">
            <ExpenseApprovalsTimeline approvals={detail.approvals} profilesMap={detail.profilesMap} />
          </TabsContent>
          <TabsContent value="payments">
            <ExpensePaymentsPanel
              payments={detail.payments}
              currency={currencySafe(expense.currency)}
              profilesMap={detail.profilesMap}
              canManagePayments={canManagePayments}
              canRecordPayment={canRecordPayment}
              onRecordPayment={openRecordDialog}
              onVoidPayment={(payment) => {
                setPaymentToVoid(payment);
                setVoidReason("");
                setVoidDialogOpen(true);
              }}
            />
          </TabsContent>
          <TabsContent value="attachments">
            <ExpenseAttachmentsPanel
              receipts={detail.receipts}
              profilesMap={detail.profilesMap}
              onOpenReceipt={(receipt) => void handleOpenReceipt(receipt.storage_path)}
            />
          </TabsContent>
        </Tabs>
      </div>

      <RecordExpensePaymentDialog
        open={recordDialogOpen}
        onOpenChange={setRecordDialogOpen}
        values={paymentForm}
        onChange={setPaymentForm}
        onSubmit={() => void handleRecordPayment()}
        submitting={recordPaymentMutation.isPending}
        remainingBalance={remainingBalance}
        currency={expense.currency}
      />

      <VoidExpensePaymentDialog
        open={voidDialogOpen}
        onOpenChange={setVoidDialogOpen}
        payment={paymentToVoid}
        voidReason={voidReason}
        onVoidReasonChange={setVoidReason}
        onSubmit={() => void handleVoidPayment()}
        submitting={voidPaymentMutation.isPending}
        currency={expense.currency}
      />
    </div>
  );
}
