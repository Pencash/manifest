import test from "node:test";
import assert from "node:assert/strict";
import { buildRestrictedFundMonths, isRestrictedGivingType, summarizeRestrictedFunds } from "./restricted-funds.ts";

test("detects restricted giving types", () => {
  assert.equal(isRestrictedGivingType("Tithe"), true);
  assert.equal(isRestrictedGivingType("First Fruits"), true);
  assert.equal(isRestrictedGivingType("Offering"), false);
});

test("computes monthly restricted fund remittance balances", () => {
  const months = buildRestrictedFundMonths(
    [
      { amount: 1000, created_at: "2026-02-10T10:00:00Z", status: "verified", giving_types: { name: "Tithe" } },
      { amount: 500, created_at: "2026-02-12T10:00:00Z", status: "verified", giving_types: { name: "Offering" } },
      { amount: 250, created_at: "2026-02-14T10:00:00Z", status: "pending", giving_types: { name: "Seed" } },
    ],
    [
      { id: "r1", amount: 400, remittance_month: "2026-02-01", remitted_at: "2026-03-01T10:00:00Z", currency: "MWK", payment_method: "bank_transfer", payment_reference: "ABC123", notes: null, status: "posted", recorded_by: "u1" },
    ],
  );

  assert.equal(months.length, 1);
  assert.equal(months[0].collected, 1000);
  assert.equal(months[0].remitted, 400);
  assert.equal(months[0].pending, 600);
  assert.equal(summarizeRestrictedFunds(months).totalPending, 600);
});