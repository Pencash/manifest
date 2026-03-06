import test from "node:test";
import assert from "node:assert/strict";
import { computeAvailableFunds, sumAmounts } from "./funding.ts";

test("sumAmounts handles empty inputs", () => {
  assert.equal(sumAmounts(undefined), 0);
  assert.equal(sumAmounts([]), 0);
});

test("sumAmounts coerces string and number amounts", () => {
  assert.equal(sumAmounts([{ amount: "10" }, { amount: 25 }]), 35);
});

test("computeAvailableFunds subtracts allocations", () => {
  assert.equal(computeAvailableFunds(1000, 275), 725);
});
