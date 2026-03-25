export type PaymentAwareExpenseStatus =
  | "approved"
  | "partially_paid"
  | "paid";

export interface ExpensePaymentLike {
  amount: number | string;
  status?: string | null;
}

export const calculatePostedPaymentsTotal = (payments: ExpensePaymentLike[] | null | undefined): number =>
  payments?.reduce((sum, payment) => {
    if (payment.status && payment.status !== "posted") {
      return sum;
    }

    return sum + Number(payment.amount);
  }, 0) ?? 0;

export const calculateRemainingBalance = (requestedAmount: number, paidAmount: number): number =>
  Math.max(requestedAmount - paidAmount, 0);

export const derivePaymentAwareExpenseStatus = (
  requestedAmount: number,
  paidAmount: number,
): PaymentAwareExpenseStatus => {
  if (paidAmount <= 0) {
    return "approved";
  }

  if (paidAmount < requestedAmount) {
    return "partially_paid";
  }

  return "paid";
};
