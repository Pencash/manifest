export interface NamedProfile {
  full_name: string;
  email: string | null;
}

export interface ExpenseRequestDetail {
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

export interface ApprovalRecord {
  id: string;
  approver_id: string;
  action: string;
  comments: string | null;
  created_at: string;
}

export interface PaymentRecord {
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

export interface ReceiptRecord {
  id: string;
  file_name: string;
  file_size: number | null;
  storage_path: string;
  uploaded_at: string;
  uploaded_by: string;
}

export interface ExpenseRequestDetailData {
  expense: ExpenseRequestDetail;
  requesterProfile: NamedProfile | null;
  paidByProfile: NamedProfile | null;
  approvals: ApprovalRecord[];
  payments: PaymentRecord[];
  receipts: ReceiptRecord[];
  profilesMap: Record<string, NamedProfile>;
}

export interface ExpenseRequestRow {
  id: string;
  request_number: string | null;
  requester_id: string;
  amount: number;
  currency: string;
  description: string;
  priority: string;
  status: string;
  created_at: string;
  paid_at: string | null;
  paid_by: string | null;
  expense_categories: { name: string; code: string } | null;
  services: { name: string } | null;
  profiles: NamedProfile;
  paidTotal: number;
  remainingBalance: number;
  paymentCount: number;
  settledByProfile: NamedProfile | null;
}

export interface ExpensePaymentFormValues {
  amount: string;
  payment_method: string;
  payment_reference: string;
  payee_name: string;
  payment_date: string;
  notes: string;
}

export interface RecordExpensePaymentInput {
  expenseRequestId: string;
  amount: number;
  paymentDateIso: string;
  paymentMethod: string;
  paymentReference: string | null;
  payeeName: string | null;
  notes: string | null;
  recordedBy: string;
}

export interface VoidExpensePaymentInput {
  paymentId: string;
  existingNotes: string | null;
  voidReason: string;
}
