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
  is_archived?: boolean;
  archived_at?: string | null;
  archived_by?: string | null;
  archive_reason?: string | null;
  expense_categories: { name: string; code: string } | null;
  services: { name: string; service_date?: string | null } | null;
}

export interface NamedProfile {
  full_name: string;
  email: string | null;
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
