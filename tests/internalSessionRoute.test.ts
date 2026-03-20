import test from "node:test";
import assert from "node:assert/strict";
import { DELETE, POST } from "../app/api/internal/session/route";

const INTERNAL_TEST_KEY = "internal-test-key";

test.beforeEach(() => {
  process.env.EMPIRE_INTERNAL_API_KEY = INTERNAL_TEST_KEY;
});

test.after(() => {
  delete process.env.EMPIRE_INTERNAL_API_KEY;
});

test("internal session route rejects unauthenticated session creation", async () => {
  const res = await POST(new Request("http://localhost/api/internal/session", { method: "POST" }));
  const payload = await res.json();

  assert.equal(res.status, 401);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "UNAUTHORIZED");
});

test("internal session route sets secure HttpOnly cookie when auth is valid", async () => {
  const res = await POST(
    new Request("http://localhost/api/internal/session", {
      method: "POST",
      headers: {
        "x-empire-internal-key": INTERNAL_TEST_KEY
      }
    })
  );
  const payload = await res.json();
  const setCookie = res.headers.get("set-cookie") || "";

  assert.equal(res.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(setCookie.includes("empire_internal_session="));
  assert.ok(setCookie.toLowerCase().includes("httponly"));
  assert.ok(setCookie.toLowerCase().includes("samesite=strict"));
});

test("internal session route can clear existing session cookie", async () => {
  const res = await DELETE(
    new Request("http://localhost/api/internal/session", {
      method: "DELETE",
      headers: {
        "x-empire-internal-key": INTERNAL_TEST_KEY
      }
    })
  );
  const payload = await res.json();
  const setCookie = res.headers.get("set-cookie") || "";

  assert.equal(res.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(setCookie.includes("empire_internal_session="));
  assert.ok(setCookie.includes("Max-Age=0"));
});

test("internal session route rejects unauthenticated session clear", async () => {
  const res = await DELETE(new Request("http://localhost/api/internal/session", { method: "DELETE" }));
  const payload = await res.json();

  assert.equal(res.status, 401);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "UNAUTHORIZED");
});
