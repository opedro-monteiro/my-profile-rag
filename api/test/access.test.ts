import assert from "node:assert/strict";
import { test } from "node:test";
import { createAccessCheck } from "../src/api/access.ts";

test("grants only configured bearer tokens", () => {
  const hasAccess = createAccessCheck(["abc123", "xyz789"]);

  assert.equal(hasAccess("Bearer abc123"), true);
  assert.equal(hasAccess("bearer xyz789"), true);
  assert.equal(hasAccess("Bearer abc12"), false);
  assert.equal(hasAccess("abc123"), false);
  assert.equal(hasAccess(undefined), false);
});

test("grants nobody when no tokens are configured", () => {
  assert.equal(createAccessCheck([])("Bearer "), false);
  assert.equal(createAccessCheck([])("Bearer anything"), false);
});
