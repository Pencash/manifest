import test from "node:test";
import assert from "node:assert/strict";
import { hasAdminAccess } from "./roles.ts";

test("hasAdminAccess returns true for admin roles", () => {
  assert.equal(hasAdminAccess("admin"), true);
  assert.equal(hasAdminAccess("finance"), true);
  assert.equal(hasAdminAccess("pastor"), true);
});

test("hasAdminAccess returns false for missing or member role", () => {
  assert.equal(hasAdminAccess("member"), false);
  assert.equal(hasAdminAccess(null), false);
});
