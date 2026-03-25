import { supabase } from "@/integrations/supabase/client";
import { calculatePostedPaymentsTotal, calculateRemainingBalance } from "@/lib/expense-payments";
import type {
  ExpenseRequestDetailData,
  ExpenseRequestRow,
  RecordExpensePaymentInput,
  VoidExpensePaymentInput,
} from "@/features/expenses/types";

export const fetchExpenseRequestDetail = async (expenseId: string): Promise<ExpenseRequestDetailData> => {
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
    ? await supabase.from("profiles").select("id, full_name, email").in("id", [...profileIds])
    : { data: [], error: null };

  if (profilesError) throw profilesError;

  const profilesMap = Object.fromEntries(
    (profilesData || []).map((profile) => [
      profile.id,
      { full_name: profile.full_name || "Unknown user", email: profile.email },
    ]),
  );

  return {
    expense: expenseData as ExpenseRequestDetailData["expense"],
    requesterProfile: profilesMap[expenseData.requester_id] || { full_name: "Unknown user", email: null },
    paidByProfile: expenseData.paid_by ? profilesMap[expenseData.paid_by] || { full_name: "Unknown user", email: null } : null,
    approvals: approvalsData || [],
    payments: (paymentsData || []).map((payment) => ({ ...payment, amount: Number(payment.amount) })),
    receipts: receiptsData || [],
    profilesMap,
  };
};

export const fetchExpenseRegister = async (filterStatus: string): Promise<ExpenseRequestRow[]> => {
  let query = supabase
    .from("expense_requests")
    .select(`
      id,
      request_number,
      requester_id,
      amount,
      currency,
      description,
      priority,
      status,
      created_at,
      paid_at,
      paid_by,
      expense_categories(name, code),
      services(name)
    `)
    .order("created_at", { ascending: false });

  if (filterStatus !== "all") {
    query = query.eq("status", filterStatus);
  }

  const { data, error } = await query;
  if (error) throw error;

  const requestRows = data || [];
  const profileIds = [...new Set(requestRows.flatMap((row) => [row.requester_id, row.paid_by]).filter(Boolean))];
  const requestIds = requestRows.map((row) => row.id);

  const [profilesRes, paymentsRes] = await Promise.all([
    profileIds.length
      ? supabase.from("profiles").select("id, full_name, email").in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    requestIds.length
      ? supabase.from("expense_payments").select("expense_request_id, amount, status").in("expense_request_id", requestIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesRes.error) throw profilesRes.error;
  if (paymentsRes.error) throw paymentsRes.error;

  const profilesMap = new Map(
    (profilesRes.data || []).map((profile) => [profile.id, { full_name: profile.full_name || "Unknown user", email: profile.email }]),
  );

  const paymentsByRequest = new Map<string, Array<{ amount: number; status: string }>>();
  (paymentsRes.data || []).forEach((payment) => {
    const existing = paymentsByRequest.get(payment.expense_request_id) || [];
    existing.push({ amount: Number(payment.amount), status: payment.status });
    paymentsByRequest.set(payment.expense_request_id, existing);
  });

  return requestRows.map((request) => {
    const requestPayments = paymentsByRequest.get(request.id) || [];
    const paidTotal = calculatePostedPaymentsTotal(requestPayments);

    return {
      ...request,
      profiles: profilesMap.get(request.requester_id) || { full_name: "Unknown user", email: null },
      paidTotal,
      remainingBalance: calculateRemainingBalance(Number(request.amount), paidTotal),
      paymentCount: requestPayments.filter((payment) => payment.status === "posted").length,
      settledByProfile: request.paid_by ? profilesMap.get(request.paid_by) || { full_name: "Unknown user", email: null } : null,
    } as ExpenseRequestRow;
  });
};

export const recordExpensePayment = async (input: RecordExpensePaymentInput) => {
  const { error } = await supabase.from("expense_payments").insert({
    expense_request_id: input.expenseRequestId,
    amount: input.amount,
    payment_date: input.paymentDateIso,
    payment_method: input.paymentMethod,
    payment_reference: input.paymentReference,
    payee_name: input.payeeName,
    notes: input.notes,
    recorded_by: input.recordedBy,
  });

  if (error) throw error;
};

export const voidExpensePayment = async (input: VoidExpensePaymentInput) => {
  const nextNotes = [
    input.existingNotes,
    input.voidReason.trim() ? `VOID REASON: ${input.voidReason.trim()}` : "VOID REASON: Not provided",
  ]
    .filter(Boolean)
    .join("\n\n");

  const { error } = await supabase
    .from("expense_payments")
    .update({
      status: "voided",
      notes: nextNotes,
    })
    .eq("id", input.paymentId);

  if (error) throw error;
};

export const getExpenseReceiptSignedUrl = async (storagePath: string) => {
  const { data, error } = await supabase.storage.from("expense-receipts").createSignedUrl(storagePath, 60);
  if (error) throw error;
  return data.signedUrl;
};
