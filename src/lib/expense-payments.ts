export type PaymentAwareExpenseStatus = "approved" | "partially_paid" | "paid";

export type ExpensePaymentMethod = "cash" | "bank_transfer" | "mobile_money" | "card" | "cheque" | "other";

export interface ExpensePaymentLike {
  amount: number | string;
  status?: string | null;
}

export interface ExpensePaymentValidationInput {
  amount: number;
  remainingBalance: number;
  paymentMethod: string;
  paymentReference?: string | null;
  payeeName?: string | null;
}

export const calculatePostedPaymentsTotal = (payments: ExpensePaymentLike[] | null | undefined): number =>
  payments?.reduce((sum, payment) => {
    if (payment.status && payment.status !== "posted") {
      return sum;
    }

    return sum + Number(payment.amount);
  }, 0) ?? 0;

export const calculateRemainingBalance = (requestedAmount: number, paidAmount: number): number => Math.max(requestedAmount - paidAmount, 0);

export const derivePaymentAwareExpenseStatus = (requestedAmount: number, paidAmount: number): PaymentAwareExpenseStatus => {
  if (paidAmount <= 0) {
    return "approved";
  }

  if (paidAmount < requestedAmount) {
    return "partially_paid";
  }

  return "paid";
};

export const paymentMethodRequiresReference = (method: string): boolean =>
  ["bank_transfer", "mobile_money", "card", "cheque"].includes(method);

export const validateExpensePaymentInput = ({
  amount,
  remainingBalance,
  paymentMethod,
  paymentReference,
  payeeName,
}: ExpensePaymentValidationInput): string[] => {
  const errors: string[] = [];

  if (!Number.isFinite(amount) || amount <= 0) {
    errors.push("Please enter a valid payment amount.");
  }

  if (amount > remainingBalance + 0.001) {
    errors.push(`Payment amount exceeds the remaining balance of ${remainingBalance}.`);
  }

  if (!payeeName?.trim()) {
    errors.push("Please capture who was paid for this disbursement.");
  }

  if (paymentMethodRequiresReference(paymentMethod) && (paymentReference?.trim().length ?? 0) < 4) {
    errors.push("A payment reference of at least 4 characters is required for this payment method.");
  }

  return errors;
};
