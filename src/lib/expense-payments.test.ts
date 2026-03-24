import test from "node:test";
import assert from "node:assert/strict";

import {
  calculatePostedPaymentsTotal,
  calculateRemainingBalance,
  derivePaymentAwareExpenseStatus,
} from "./expense-payments.ts";

// ── calculatePostedPaymentsTotal ──────────────────────────────────

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

test("calculatePostedPaymentsTotal treats null/undefined status as posted", () => {
  assert.equal(
    calculatePostedPaymentsTotal([
      { amount: 200, status: null },
      { amount: 300, status: undefined },
      { amount: 100, status: "posted" },
    ]),
    600,
  );
});

test("calculatePostedPaymentsTotal returns 0 for null/undefined/empty input", () => {
  assert.equal(calculatePostedPaymentsTotal(null), 0);
  assert.equal(calculatePostedPaymentsTotal(undefined), 0);
  assert.equal(calculatePostedPaymentsTotal([]), 0);
});

test("calculatePostedPaymentsTotal ignores all non-posted statuses", () => {
  assert.equal(
    calculatePostedPaymentsTotal([
      { amount: 500, status: "voided" },
      { amount: 300, status: "cancelled" },
      { amount: 200, status: "draft" },
    ]),
    0,
  );
});

test("calculatePostedPaymentsTotal handles string amounts correctly", () => {
  assert.equal(
    calculatePostedPaymentsTotal([
      { amount: "1000.50", status: "posted" },
      { amount: "250.25", status: null },
    ]),
    1250.75,
  );
});

// ── calculateRemainingBalance ──────────────────────────────────────

test("calculateRemainingBalance never goes below zero", () => {
  assert.equal(calculateRemainingBalance(1000, 200), 800);
  assert.equal(calculateRemainingBalance(1000, 1200), 0);
});

test("calculateRemainingBalance returns full amount when nothing paid", () => {
  assert.equal(calculateRemainingBalance(5000, 0), 5000);
});

test("calculateRemainingBalance returns 0 when exact match", () => {
  assert.equal(calculateRemainingBalance(1000, 1000), 0);
});

test("calculateRemainingBalance handles fractional amounts", () => {
  const result = calculateRemainingBalance(100.50, 25.25);
  assert.equal(result, 75.25);
});

// ── derivePaymentAwareExpenseStatus ───────────────────────────────

test("derivePaymentAwareExpenseStatus reflects unpaid, partial, and paid states", () => {
  assert.equal(derivePaymentAwareExpenseStatus(1000, 0), "approved");
  assert.equal(derivePaymentAwareExpenseStatus(1000, 400), "partially_paid");
  assert.equal(derivePaymentAwareExpenseStatus(1000, 1000), "paid");
  assert.equal(derivePaymentAwareExpenseStatus(1000, 1200), "paid");
});

test("derivePaymentAwareExpenseStatus returns approved for negative paid", () => {
  assert.equal(derivePaymentAwareExpenseStatus(1000, -100), "approved");
});

test("derivePaymentAwareExpenseStatus returns partially_paid for tiny payment", () => {
  assert.equal(derivePaymentAwareExpenseStatus(1000, 0.01), "partially_paid");
});

test("derivePaymentAwareExpenseStatus returns paid when overpaid", () => {
  assert.equal(derivePaymentAwareExpenseStatus(500, 9999), "paid");
});

// ── voided payment recalculation scenario ─────────────────────────

test("voiding a payment recalculates totals correctly", () => {
  const payments = [
    { amount: 500, status: "posted" },
    { amount: 300, status: "posted" },
    { amount: 200, status: "voided" },
  ];
  const total = calculatePostedPaymentsTotal(payments);
  assert.equal(total, 800);
  assert.equal(calculateRemainingBalance(1000, total), 200);
  assert.equal(derivePaymentAwareExpenseStatus(1000, total), "partially_paid");
});

test("voiding all payments reverts to approved", () => {
  const payments = [
    { amount: 500, status: "voided" },
    { amount: 300, status: "voided" },
  ];
  const total = calculatePostedPaymentsTotal(payments);
  assert.equal(total, 0);
  assert.equal(derivePaymentAwareExpenseStatus(1000, total), "approved");
});

test("voiding last posted payment recalculates from partial to approved", () => {
  const beforeVoid = [
    { amount: 500, status: "posted" },
    { amount: 300, status: "posted" },
  ];
  assert.equal(derivePaymentAwareExpenseStatus(1000, calculatePostedPaymentsTotal(beforeVoid)), "partially_paid");

  const afterVoid = [
    { amount: 500, status: "voided" },
    { amount: 300, status: "voided" },
  ];
  assert.equal(derivePaymentAwareExpenseStatus(1000, calculatePostedPaymentsTotal(afterVoid)), "approved");
});

// ── budget-related: only posted payments count toward spend ───────

test("budget totals should only include posted payments", () => {
  const allPayments = [
    { amount: 1000, status: "posted" },
    { amount: 500, status: "voided" },
    { amount: 750, status: "posted" },
    { amount: 250, status: "voided" },
  ];
  const budgetSpend = calculatePostedPaymentsTotal(allPayments);
  assert.equal(budgetSpend, 1750);
});
