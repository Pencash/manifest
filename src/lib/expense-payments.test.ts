import test from "node:test";
import assert from "node:assert/strict";

import {
  calculatePostedPaymentsTotal,
  calculateRemainingBalance,
  derivePaymentAwareExpenseStatus,
  paymentMethodRequiresReference,
  validateExpensePaymentInput,
} from "./expense-payments.ts";

test("calculatePostedPaymentsTotal only sums posted payments", () => {
  assert.equal(
    calculatePostedPaymentsTotal([
      { amount: 1000, status: "posted" },
      { amount: "500", status: "posted" },
      { amount: 999, status: "voided" },
    ]),
    1500,
  );
});

test("calculateRemainingBalance never goes below zero", () => {
  assert.equal(calculateRemainingBalance(1000, 200), 800);
  assert.equal(calculateRemainingBalance(1000, 1200), 0);
});

test("derivePaymentAwareExpenseStatus reflects unpaid, partial, and paid states", () => {
  assert.equal(derivePaymentAwareExpenseStatus(1000, 0), "approved");
  assert.equal(derivePaymentAwareExpenseStatus(1000, 400), "partially_paid");
  assert.equal(derivePaymentAwareExpenseStatus(1000, 1000), "paid");
  assert.equal(derivePaymentAwareExpenseStatus(1000, 1200), "paid");
});

test("paymentMethodRequiresReference only flags traceable methods", () => {
  assert.equal(paymentMethodRequiresReference("cash"), false);
  assert.equal(paymentMethodRequiresReference("other"), false);
  assert.equal(paymentMethodRequiresReference("bank_transfer"), true);
  assert.equal(paymentMethodRequiresReference("mobile_money"), true);
});

test("validateExpensePaymentInput enforces amount, payee, and reference rules", () => {
  const errors = validateExpensePaymentInput({
    amount: 1200,
    remainingBalance: 1000,
    paymentMethod: "bank_transfer",
    paymentReference: "12",
    payeeName: "",
  });

  assert.deepEqual(errors, [
    "Payment amount exceeds the remaining balance of 1000.",
    "Please capture who was paid for this disbursement.",
    "A payment reference of at least 4 characters is required for this payment method.",
  ]);
});

test("validateExpensePaymentInput allows valid cash entries without a reference", () => {
  const errors = validateExpensePaymentInput({
    amount: 500,
    remainingBalance: 1000,
    paymentMethod: "cash",
    paymentReference: "",
    payeeName: "Stationery Vendor",
  });

  assert.deepEqual(errors, []);
});
