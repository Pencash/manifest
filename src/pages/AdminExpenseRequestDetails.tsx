import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileClock,
  FileText,
  FolderOpen,
  HandCoins,
  Loader2,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Wallet,
  XCircle,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { hasAdminAccess, type AppRole } from "@/lib/roles";
import { triggerNotificationRefresh } from "@/lib/notification-events";
import {
  calculatePostedPaymentsTotal,
  calculateRemainingBalance,
  derivePaymentAwareExpenseStatus,
} from "@/lib/expense-payments";
import { cn, formatAmount } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface ExpenseRequestDetail {
  id: string;
  request_number: string | null;
  requester_id: string;
  category_id: string;
  service_id: string | null;
  amount: number;
  currency: string;
  description: string;
  justification: string;
  priority: string;
  due_date: string | null;
  status: string;
  paid_at: string | null;
  paid_by: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  expense_categories: { name: string; code: string } | null;
  services: { name: string; service_date?: string | null } | null;
}

interface NamedProfile {
  full_name: string;
  email: string | null;
}

interface ApprovalRecord {
  id: string;
  approver_id: string;
  action: string;
  comments: string | null;
  created_at: string;
}

interface PaymentRecord {
  id: string;
  expense_request_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  payment_reference: string | null;
  payee_name: string | null;
  notes: string | null;
  status: string;
  recorded_by: string;
  created_at: string;
}

interface ReceiptRecord {
  id: string;
  file_name: string;
  file_size: number | null;
  storage_path: string;
  uploaded_at: string;
  uploaded_by: string;
}

const statusBadgeClasses: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  pending: "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-300 dark:border-amber-900",
  approved: "bg-blue-500/10 text-blue-700 border-blue-200 dark:text-blue-300 dark:border-blue-900",
  partially_paid: "bg-violet-500/10 text-violet-700 border-violet-200 dark:text-violet-300 dark:border-violet-900",
  paid: "bg-green-500/10 text-green-700 border-green-200 dark:text-green-300 dark:border-green-900",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  changes_requested: "bg-orange-500/10 text-orange-700 border-orange-200 dark:text-orange-300 dark:border-orange-900",
  cancelled: "bg-muted text-muted-foreground border-border",
};

const priorityBadgeClasses: Record<string, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-primary/10 text-primary border-primary/20",
  high: "bg-orange-500/10 text-orange-700 border-orange-200 dark:text-orange-300 dark:border-orange-900",
  urgent: "bg-destructive/10 text-destructive border-destructive/20",
};

const approvalBadgeClasses: Record<string, string> = {
  approved: "bg-green-500/10 text-green-700 border-green-200 dark:text-green-300 dark:border-green-900",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  changes_requested: "bg-orange-500/10 text-orange-700 border-orange-200 dark:text-orange-300 dark:border-orange-900",
};

const currencySafe = (value?: string | null) => value || "MWK";

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  return format(new Date(value), "dd MMM yyyy, HH:mm");
};

const formatDateOnly = (value?: string | null) => {
  if (!value) return "—";
  return format(new Date(value), "dd MMM yyyy");
};

const formatFileSize = (value?: number | null) => {
  if (!value || value <= 0) return "Unknown size";

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatMethodLabel = (value?: string | null) => {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

const EmptyState = ({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof FileText;
  title: string;
  description: string;
}) => (
  <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
    <Icon className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
    <h3 className="text-lg font-semibold">{title}</h3>
    <p className="mt-2 text-sm text-muted-foreground">{description}</p>
  </div>
);

export default function AdminExpenseRequestDetails() {
  const navigate = useNavigate();
  const { expenseId } = useParams<{ expenseId: string }>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [role, setRole] = useState<AppRole | null>(null);
  const [expense, setExpense] = useState<ExpenseRequestDetail | null>(null);
  const [requesterProfile, setRequesterProfile] = useState<NamedProfile | null>(null);
  const [paidByProfile, setPaidByProfile] = useState<NamedProfile | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, NamedProfile>>({});
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [paymentToVoid, setPaymentToVoid] = useState<PaymentRecord | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [voidingPayment, setVoidingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_method: "bank_transfer",
    payment_reference: "",
    payee_name: "",
    payment_date: new Date().toISOString().slice(0, 16),
    notes: "",
  });
  const [voidReason, setVoidReason] = useState("");

  useEffect(() => {
    void checkAuthAndLoad();
  }, [expenseId]);

  const checkAuthAndLoad = async () => {
    try {
      setLoading(true);

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
      await loadExpenseDetail();
    } catch (error: any) {
      toast.error(error.message || "Failed to load expense details");
    } finally {
      setLoading(false);
    }
  };

  const loadExpenseDetail = async () => {
    if (!expenseId) return;

    try {
      setRefreshing(true);

      const { data: expenseData, error: expenseError } = await supabase
        .from("expense_requests")
        .select(`
          id,
          request_number,
          requester_id,
          category_id,
          service_id,
          amount,
          currency,
          description,
          justification,
          priority,
          due_date,
          status,
          paid_at,
          paid_by,
          payment_method,
          payment_reference,
          rejection_reason,
          created_at,
          updated_at,
          expense_categories(name, code),
          services(name, service_date)
        `)
        .eq("id", expenseId)
        .single();

      if (expenseError) throw expenseError;
      if (!expenseData) throw new Error("Expense request not found");

      const [{ data: approvalsData, error: approvalsError }, { data: paymentsData, error: paymentsError }, { data: receiptsData, error: receiptsError }] = await Promise.all([
        supabase
          .from("expense_approvals")
          .select("id, approver_id, action, comments, created_at")
          .eq("expense_request_id", expenseId)
          .order("created_at", { ascending: false }),
        supabase
          .from("expense_payments")
          .select("id, expense_request_id, amount, payment_date, payment_method, payment_reference, payee_name, notes, status, recorded_by, created_at")
          .eq("expense_request_id", expenseId)
          .order("payment_date", { ascending: false }),
        supabase
          .from("expense_receipts")
          .select("id, file_name, file_size, storage_path, uploaded_at, uploaded_by")
          .eq("expense_request_id", expenseId)
          .order("uploaded_at", { ascending: false }),
      ]);

      if (approvalsError) throw approvalsError;
      if (paymentsError) throw paymentsError;
      if (receiptsError) throw receiptsError;

      const profileIds = new Set<string>();
      profileIds.add(expenseData.requester_id);
      if (expenseData.paid_by) profileIds.add(expenseData.paid_by);
      (approvalsData || []).forEach((approval) => profileIds.add(approval.approver_id));
      (paymentsData || []).forEach((payment) => profileIds.add(payment.recorded_by));
      (receiptsData || []).forEach((receipt) => profileIds.add(receipt.uploaded_by));

      const { data: profilesData, error: profilesError } = profileIds.size
        ? await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", [...profileIds])
        : { data: [], error: null };

      if (profilesError) throw profilesError;

      const nextProfilesMap = Object.fromEntries(
        (profilesData || []).map((profile) => [
          profile.id,
          { full_name: profile.full_name || "Unknown user", email: profile.email },
        ]),
      );

      setProfilesMap(nextProfilesMap);
      setExpense(expenseData as unknown as ExpenseRequestDetail);
      setRequesterProfile(nextProfilesMap[expenseData.requester_id] || { full_name: "Unknown user", email: null });
      setPaidByProfile(expenseData.paid_by ? nextProfilesMap[expenseData.paid_by] || { full_name: "Unknown user", email: null } : null);
      setApprovals((approvalsData || []) as ApprovalRecord[]);
      setPayments((paymentsData || []) as PaymentRecord[]);
      setReceipts((receiptsData || []) as ReceiptRecord[]);
      setPaymentForm((prev) => ({
        ...prev,
        amount: expenseData.amount.toString(),
      }));
    } catch (error: any) {
      toast.error(error.message || "Failed to load expense details");
      console.error(error);
    } finally {
      setRefreshing(false);
    }
  };

  const postedTotal = useMemo(() => calculatePostedPaymentsTotal(payments), [payments]);
  const requestedAmount = expense?.amount || 0;
  const remainingBalance = calculateRemainingBalance(requestedAmount, postedTotal);
  const paymentProgress = requestedAmount > 0 ? Math.min((postedTotal / requestedAmount) * 100, 100) : 0;
  const derivedPaymentStatus = requestedAmount > 0 ? derivePaymentAwareExpenseStatus(requestedAmount, postedTotal) : "approved";
  const latestPostedPayment = useMemo(
    () => payments.find((payment) => payment.status === "posted") || null,
    [payments],
  );
  const canManagePayments = role === "admin" || role === "finance";
  const canRecordPayment = Boolean(expense && canManagePayments && ["approved", "partially_paid"].includes(expense.status));

  const resetPaymentForm = () => {
    setPaymentForm({
      amount: remainingBalance > 0 ? remainingBalance.toString() : expense?.amount?.toString() || "",
      payment_method: "bank_transfer",
      payment_reference: "",
      payee_name: "",
      payment_date: new Date().toISOString().slice(0, 16),
      notes: "",
    });
  };

  const handleOpenRecordDialog = () => {
    resetPaymentForm();
    setRecordDialogOpen(true);
  };

  const handleRecordPayment = async () => {
    if (!expense) return;

    try {
      setSubmittingPayment(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      const amount = Number(paymentForm.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Please enter a valid payment amount.");
      }

      if (amount > remainingBalance + 0.001) {
        throw new Error(`Payment amount exceeds the remaining balance of ${formatAmount(remainingBalance, currencySafe(expense.currency))}.`);
      }

      const { error } = await supabase.from("expense_payments").insert({
        expense_request_id: expense.id,
        amount,
        payment_date: new Date(paymentForm.payment_date).toISOString(),
        payment_method: paymentForm.payment_method,
        payment_reference: paymentForm.payment_reference.trim() || null,
        payee_name: paymentForm.payee_name.trim() || null,
        notes: paymentForm.notes.trim() || null,
        recorded_by: user.id,
      });

      if (error) throw error;

      toast.success("Payment recorded successfully.");
      setRecordDialogOpen(false);
      await loadExpenseDetail();
      triggerNotificationRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to record payment");
      console.error(error);
    } finally {
      setSubmittingPayment(false);
    }
  };

  const openVoidDialog = (payment: PaymentRecord) => {
    setPaymentToVoid(payment);
    setVoidReason("");
    setVoidDialogOpen(true);
  };

  const handleVoidPayment = async () => {
    if (!paymentToVoid) return;

    try {
      setVoidingPayment(true);

      const nextNotes = [paymentToVoid.notes, voidReason.trim() ? `VOID REASON: ${voidReason.trim()}` : "VOID REASON: Not provided"]
        .filter(Boolean)
        .join("\n\n");

      const { error } = await supabase
        .from("expense_payments")
        .update({
          status: "voided",
          notes: nextNotes,
        })
        .eq("id", paymentToVoid.id);

      if (error) throw error;

      toast.success("Payment voided successfully.");
      setVoidDialogOpen(false);
      setPaymentToVoid(null);
      await loadExpenseDetail();
      triggerNotificationRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to void payment");
      console.error(error);
    } finally {
      setVoidingPayment(false);
    }
  };

  const handleOpenReceipt = async (receipt: ReceiptRecord) => {
    try {
      const { data, error } = await supabase.storage.from("expense-receipts").createSignedUrl(receipt.storage_path, 60);
      if (error) throw error;
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      toast.error(error.message || "Failed to open receipt");
      console.error(error);
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
        <EmptyState
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

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <CardDescription>Requested amount</CardDescription>
              <CardTitle className="text-2xl">{formatAmount(requestedAmount, currencySafe(expense.currency))}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <HandCoins className="h-4 w-4" />
                Submitted {formatDateOnly(expense.created_at)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Paid so far</CardDescription>
              <CardTitle className="text-2xl text-green-600">{formatAmount(postedTotal, currencySafe(expense.currency))}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CircleDollarSign className="h-4 w-4" />
                {payments.filter((payment) => payment.status === "posted").length} posted payment{payments.filter((payment) => payment.status === "posted").length === 1 ? "" : "s"}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Outstanding balance</CardDescription>
              <CardTitle className="text-2xl text-foreground">{formatAmount(remainingBalance, currencySafe(expense.currency))}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Banknote className="h-4 w-4" />
                {derivedPaymentStatus.replace(/_/g, " ")} payment state
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Latest posted payment</CardDescription>
              <CardTitle className="text-lg">{latestPostedPayment ? formatDateTime(latestPostedPayment.payment_date) : "No payment yet"}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock3 className="h-4 w-4" />
                {latestPostedPayment ? formatMethodLabel(latestPostedPayment.payment_method) : "Awaiting finance action"}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Payment progress</CardTitle>
                <CardDescription>
                  The payment ledger below drives the current disbursement state for this request.
                </CardDescription>
              </div>
              <Badge className={cn("border", statusBadgeClasses[derivedPaymentStatus] || statusBadgeClasses.approved)}>
                {derivedPaymentStatus.replace(/_/g, " ").toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={paymentProgress} className="h-3" />
            <div className="flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
              <span>
                {formatAmount(postedTotal, currencySafe(expense.currency))} of {formatAmount(requestedAmount, currencySafe(expense.currency))} has been disbursed.
              </span>
              <span>{paymentProgress.toFixed(1)}% complete</span>
            </div>
          </CardContent>
        </Card>

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
            <Card>
              <CardHeader>
                <CardTitle>Approval timeline</CardTitle>
                <CardDescription>Immutable decision history captured for this expense request.</CardDescription>
              </CardHeader>
              <CardContent>
                {approvals.length === 0 ? (
                  <EmptyState
                    icon={ShieldCheck}
                    title="No approval activity yet"
                    description="Approval decisions will appear here once reviewers take action."
                  />
                ) : (
                  <div className="space-y-4">
                    {approvals.map((approval, index) => (
                      <div key={approval.id} className="relative rounded-xl border bg-card p-4 shadow-sm">
                        {index < approvals.length - 1 && <div className="absolute left-7 top-16 h-[calc(100%-2rem)] w-px bg-border" />}
                        <div className="flex gap-4">
                          <div className="mt-1 rounded-full border bg-background p-2">
                            {approval.action === "approved" ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : approval.action === "rejected" ? (
                              <XCircle className="h-4 w-4 text-destructive" />
                            ) : (
                              <FileClock className="h-4 w-4 text-orange-500" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-3">
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="font-semibold">{profilesMap[approval.approver_id]?.full_name || "Unknown approver"}</p>
                                <p className="text-sm text-muted-foreground">{profilesMap[approval.approver_id]?.email || "No email available"}</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className={cn("border", approvalBadgeClasses[approval.action] || approvalBadgeClasses.changes_requested)}>
                                  {approval.action.replace(/_/g, " ").toUpperCase()}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{formatDateTime(approval.created_at)}</span>
                              </div>
                            </div>
                            <div className="rounded-lg bg-muted/40 p-3 text-sm text-foreground">
                              {approval.comments?.trim() ? approval.comments : "No additional comments were supplied for this action."}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle>Payment ledger</CardTitle>
                      <CardDescription>Every disbursement recorded against this request lives here.</CardDescription>
                    </div>
                    {canRecordPayment && (
                      <Button onClick={handleOpenRecordDialog}>
                        <Wallet className="mr-2 h-4 w-4" />
                        Record another payment
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {payments.length === 0 ? (
                    <EmptyState
                      icon={Receipt}
                      title="No payments recorded"
                      description="Finance can start the ledger by recording the first payment for this approved request."
                    />
                  ) : (
                    <ScrollArea className="w-full">
                      <div className="min-w-[920px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Method</TableHead>
                              <TableHead>Reference</TableHead>
                              <TableHead>Payee</TableHead>
                              <TableHead>Recorded by</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Notes</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {payments.map((payment) => (
                              <TableRow key={payment.id}>
                                <TableCell className="text-sm">{formatDateTime(payment.payment_date)}</TableCell>
                                <TableCell className="font-semibold">{formatAmount(payment.amount, currencySafe(expense.currency))}</TableCell>
                                <TableCell>{formatMethodLabel(payment.payment_method)}</TableCell>
                                <TableCell className="font-mono text-xs">{payment.payment_reference || "—"}</TableCell>
                                <TableCell>{payment.payee_name || "—"}</TableCell>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <span className="font-medium">{profilesMap[payment.recorded_by]?.full_name || "Unknown user"}</span>
                                    <span className="text-xs text-muted-foreground">{profilesMap[payment.recorded_by]?.email || "No email"}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge className={cn(
                                    "border",
                                    payment.status === "posted"
                                      ? "bg-green-500/10 text-green-700 border-green-200 dark:text-green-300 dark:border-green-900"
                                      : "bg-muted text-muted-foreground border-border",
                                  )}>
                                    {payment.status.toUpperCase()}
                                  </Badge>
                                </TableCell>
                                <TableCell className="max-w-xs whitespace-pre-wrap text-sm text-muted-foreground">
                                  {payment.notes || "—"}
                                </TableCell>
                                <TableCell className="text-right">
                                  {canManagePayments && payment.status === "posted" ? (
                                    <Button variant="outline" size="sm" onClick={() => openVoidDialog(payment)}>
                                      Void
                                    </Button>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="attachments">
            <Card>
              <CardHeader>
                <CardTitle>Receipts & supporting files</CardTitle>
                <CardDescription>Documents uploaded against this request for review and verification.</CardDescription>
              </CardHeader>
              <CardContent>
                {receipts.length === 0 ? (
                  <EmptyState
                    icon={Receipt}
                    title="No attachments uploaded"
                    description="Invoices, receipts, and transfer proof will appear here after upload."
                  />
                ) : (
                  <div className="space-y-3">
                    {receipts.map((receipt) => (
                      <div key={receipt.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0 space-y-1">
                          <p className="truncate font-medium">{receipt.file_name}</p>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span>{formatFileSize(receipt.file_size)}</span>
                            <span>Uploaded {formatDateTime(receipt.uploaded_at)}</span>
                            <span>By {profilesMap[receipt.uploaded_by]?.full_name || "Unknown user"}</span>
                          </div>
                        </div>
                        <Button variant="outline" onClick={() => void handleOpenReceipt(receipt)}>
                          <ArrowUpRight className="mr-2 h-4 w-4" />
                          Open file
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={recordDialogOpen} onOpenChange={setRecordDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              Add a new payment entry for this expense request. The request status will update automatically based on the ledger total.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="payment_amount">Amount</Label>
              <Input
                id="payment_amount"
                type="number"
                min="0"
                step="0.01"
                value={paymentForm.amount}
                onChange={(event) => setPaymentForm((prev) => ({ ...prev, amount: event.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Remaining balance: {formatAmount(remainingBalance, currencySafe(expense.currency))}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_date">Payment date & time</Label>
              <Input
                id="payment_date"
                type="datetime-local"
                value={paymentForm.payment_date}
                onChange={(event) => setPaymentForm((prev) => ({ ...prev, payment_date: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select
                value={paymentForm.payment_method}
                onValueChange={(value) => setPaymentForm((prev) => ({ ...prev, payment_method: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="mobile_money">Mobile money</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_reference">Payment reference</Label>
              <Input
                id="payment_reference"
                value={paymentForm.payment_reference}
                onChange={(event) => setPaymentForm((prev) => ({ ...prev, payment_reference: event.target.value }))}
                placeholder="Bank reference, transaction code, cheque number..."
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="payee_name">Paid to</Label>
              <Input
                id="payee_name"
                value={paymentForm.payee_name}
                onChange={(event) => setPaymentForm((prev) => ({ ...prev, payee_name: event.target.value }))}
                placeholder="Vendor, beneficiary, or ministry owner"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="payment_notes">Payment notes</Label>
              <Textarea
                id="payment_notes"
                value={paymentForm.notes}
                onChange={(event) => setPaymentForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Capture what was paid for, voucher details, or reconciliation notes."
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordDialogOpen(false)} disabled={submittingPayment}>
              Cancel
            </Button>
            <Button onClick={() => void handleRecordPayment()} disabled={submittingPayment}>
              {submittingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void payment entry</DialogTitle>
            <DialogDescription>
              This keeps the ledger history intact while removing the payment from posted totals and request status calculations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border bg-muted/40 p-4 text-sm">
              <p className="font-medium">{paymentToVoid ? formatAmount(paymentToVoid.amount, currencySafe(expense.currency)) : "—"}</p>
              <p className="mt-1 text-muted-foreground">{paymentToVoid ? `${formatMethodLabel(paymentToVoid.payment_method)} • ${formatDateTime(paymentToVoid.payment_date)}` : ""}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="void_reason">Void reason</Label>
              <Textarea
                id="void_reason"
                rows={4}
                value={voidReason}
                onChange={(event) => setVoidReason(event.target.value)}
                placeholder="Explain why this payment entry is being voided for audit and reconciliation clarity."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidDialogOpen(false)} disabled={voidingPayment}>
              Keep payment
            </Button>
            <Button variant="destructive" onClick={() => void handleVoidPayment()} disabled={voidingPayment}>
              {voidingPayment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Void payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
