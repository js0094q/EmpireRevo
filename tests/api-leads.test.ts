import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/leads/route";

function req(payload: unknown) {
  return new Request("http://localhost/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

test("POST /api/leads validates email and zip", async () => {
  const response = await POST(req({ email: "bad", zipCode: "123", intent: "launch_access" }));
  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.equal(payload.ok, false);
});

test("POST /api/leads accepts valid launch request without configured webhook", async () => {
  const original = process.env.LEAD_CAPTURE_WEBHOOK_URL;
  delete process.env.LEAD_CAPTURE_WEBHOOK_URL;
  try {
    const response = await POST(
      req({
        email: "user@example.com",
        zipCode: "10001",
        intent: "launch_access",
        resource: "none",
        placement: "test"
      })
    );
    assert.equal(response.status, 202);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.captured, false);
  } finally {
    if (original === undefined) {
      delete process.env.LEAD_CAPTURE_WEBHOOK_URL;
    } else {
      process.env.LEAD_CAPTURE_WEBHOOK_URL = original;
    }
  }
});
