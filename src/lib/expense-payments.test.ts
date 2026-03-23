import test from "node:test";
import assert from "node:assert/strict";

import {
  calculatePostedPaymentsTotal,
  calculateRemainingBalance,
  derivePaymentAwareExpenseStatus,
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
