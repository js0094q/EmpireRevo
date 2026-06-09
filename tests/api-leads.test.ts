import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/leads/route";

test("POST /api/leads is disabled during public testing mode", async () => {
  const response = await POST();
  assert.equal(response.status, 410);
  const payload = await response.json();
  assert.equal(payload.ok, false);
  assert.match(payload.message, /disabled/i);
});
