import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { hasAdminAccess, type AppRole } from "@/lib/roles";
import { triggerNotificationRefresh } from "@/lib/notification-events";
import {
  calculatePostedPaymentsTotal,
  calculateRemainingBalance,
  derivePaymentAwareExpenseStatus,
} from "@/lib/expense-payments";
import { formatAmount, cn } from "@/lib/utils";
import { currencySafe } from "@/lib/expense-format";
import { toast } from "sonner";
import type {
  ExpenseRequestDetail,
  NamedProfile,
  ApprovalRecord,
  PaymentRecord,
  ReceiptRecord,
} from "@/lib/expense-detail-types";

export function useExpenseRequestDetail(expenseId: string | undefined) {
  const navigate = useNavigate();
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

  const postedTotal = useMemo(() => calculatePostedPaymentsTotal(payments), [payments]);
  const requestedAmount = expense?.amount || 0;
  const remainingBalance = calculateRemainingBalance(requestedAmount, postedTotal);
  const paymentProgress = requestedAmount > 0 ? Math.min((postedTotal / requestedAmount) * 100, 100) : 0;
  const derivedPaymentStatus = requestedAmount > 0 ? derivePaymentAwareExpenseStatus(requestedAmount, postedTotal) : "approved";
  const latestPostedPayment = useMemo(
    () => payments.find((p) => p.status === "posted") || null,
    [payments],
  );
  const canManagePayments = role === "admin" || role === "finance";
  const canRecordPayment = Boolean(expense && canManagePayments && ["approved", "partially_paid"].includes(expense.status));

  const loadExpenseDetail = useCallback(async () => {
    if (!expenseId) return;
    try {
      setRefreshing(true);

      const { data: expenseData, error: expenseError } = await supabase
        .from("expense_requests")
        .select(`
          id, request_number, requester_id, category_id, service_id,
          amount, currency, description, justification, priority, due_date,
          status, paid_at, paid_by, payment_method, payment_reference,
          rejection_reason, created_at, updated_at,
          expense_categories(name, code),
          services(name, service_date)
        `)
        .eq("id", expenseId)
        .single();

      if (expenseError) throw expenseError;
      if (!expenseData) throw new Error("Expense request not found");

      const [{ data: approvalsData, error: approvalsError }, { data: paymentsData, error: paymentsError }, { data: receiptsData, error: receiptsError }] = await Promise.all([
        supabase.from("expense_approvals").select("id, approver_id, action, comments, created_at").eq("expense_request_id", expenseId).order("created_at", { ascending: false }),
        supabase.from("expense_payments").select("id, expense_request_id, amount, payment_date, payment_method, payment_reference, payee_name, notes, status, recorded_by, created_at").eq("expense_request_id", expenseId).order("payment_date", { ascending: false }),
        supabase.from("expense_receipts").select("id, file_name, file_size, storage_path, uploaded_at, uploaded_by").eq("expense_request_id", expenseId).order("uploaded_at", { ascending: false }),
      ]);

      if (approvalsError) throw approvalsError;
      if (paymentsError) throw paymentsError;
      if (receiptsError) throw receiptsError;

      const profileIds = new Set<string>();
      profileIds.add(expenseData.requester_id);
      if (expenseData.paid_by) profileIds.add(expenseData.paid_by);
      (approvalsData || []).forEach((a) => profileIds.add(a.approver_id));
      (paymentsData || []).forEach((p) => profileIds.add(p.recorded_by));
      (receiptsData || []).forEach((r) => profileIds.add(r.uploaded_by));

      const { data: profilesData, error: profilesError } = profileIds.size
        ? await supabase.from("profiles").select("id, full_name, email").in("id", [...profileIds])
        : { data: [], error: null };

      if (profilesError) throw profilesError;

      const nextProfilesMap = Object.fromEntries(
        (profilesData || []).map((p) => [p.id, { full_name: p.full_name || "Unknown user", email: p.email }]),
      );

      setProfilesMap(nextProfilesMap);
      setExpense(expenseData as unknown as ExpenseRequestDetail);
      setRequesterProfile(nextProfilesMap[expenseData.requester_id] || { full_name: "Unknown user", email: null });
      setPaidByProfile(expenseData.paid_by ? nextProfilesMap[expenseData.paid_by] || { full_name: "Unknown user", email: null } : null);
      setApprovals((approvalsData || []) as ApprovalRecord[]);
      setPayments((paymentsData || []) as PaymentRecord[]);
      setReceipts((receiptsData || []) as ReceiptRecord[]);
    } catch (error: any) {
      toast.error(error.message || "Failed to load expense details");
      console.error(error);
    } finally {
      setRefreshing(false);
    }
  }, [expenseId]);

  const checkAuthAndLoad = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/admin/auth"); return; }

      const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).single();
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
  }, [loadExpenseDetail, navigate]);

  const recordPayment = useCallback(async (form: {
    amount: string;
    payment_method: string;
    payment_reference: string;
    payee_name: string;
    payment_date: string;
    notes: string;
  }) => {
    if (!expense) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Please enter a valid payment amount.");
    if (amount > remainingBalance + 0.001) throw new Error(`Payment amount exceeds the remaining balance of ${formatAmount(remainingBalance, currencySafe(expense.currency))}.`);

    const { error } = await supabase.from("expense_payments").insert({
      expense_request_id: expense.id,
      amount,
      payment_date: new Date(form.payment_date).toISOString(),
      payment_method: form.payment_method,
      payment_reference: form.payment_reference.trim() || null,
      payee_name: form.payee_name.trim() || null,
      notes: form.notes.trim() || null,
      recorded_by: user.id,
    });
    if (error) throw error;
    await loadExpenseDetail();
    triggerNotificationRefresh();
  }, [expense, remainingBalance, loadExpenseDetail]);

  const voidPayment = useCallback(async (payment: PaymentRecord, reason: string) => {
    const nextNotes = [payment.notes, reason.trim() ? `VOID REASON: ${reason.trim()}` : "VOID REASON: Not provided"]
      .filter(Boolean)
      .join("\n\n");

    const { error } = await supabase.from("expense_payments").update({ status: "voided", notes: nextNotes }).eq("id", payment.id);
    if (error) throw error;
    await loadExpenseDetail();
    triggerNotificationRefresh();
  }, [loadExpenseDetail]);

  const openReceipt = useCallback(async (receipt: ReceiptRecord) => {
    const { data, error } = await supabase.storage.from("expense-receipts").createSignedUrl(receipt.storage_path, 60);
    if (error) throw error;
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }, []);

  return {
    loading, refreshing, role, expense,
    requesterProfile, paidByProfile,
    approvals, payments, receipts, profilesMap,
    postedTotal, requestedAmount, remainingBalance,
    paymentProgress, derivedPaymentStatus,
    latestPostedPayment, canManagePayments, canRecordPayment,
    checkAuthAndLoad, loadExpenseDetail,
    recordPayment, voidPayment, openReceipt,
  };
}
