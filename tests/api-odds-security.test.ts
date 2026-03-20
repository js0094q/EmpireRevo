import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/odds/route";

test("GET /api/odds rejects invalid sportKey", async () => {
  let fetchCalled = false;
  const fetchMock = mock.method(globalThis, "fetch", async () => {
    fetchCalled = true;
    return new Response("[]", { status: 200 });
  });

  const response = await GET(new Request("http://localhost/api/odds?sportKey=../../etc/passwd"));
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "BAD_REQUEST");
  assert.equal(fetchCalled, false);
  fetchMock.mock.restore();
});

test("GET /api/odds format=raw requires internal auth", async () => {
  const originalInternalKey = process.env.EMPIRE_INTERNAL_API_KEY;
  process.env.EMPIRE_INTERNAL_API_KEY = "internal-test-key";

  const response = await GET(new Request("http://localhost/api/odds?format=raw"));
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "UNAUTHORIZED");

  if (originalInternalKey === undefined) {
    delete process.env.EMPIRE_INTERNAL_API_KEY;
  } else {
    process.env.EMPIRE_INTERNAL_API_KEY = originalInternalKey;
  }
});

test("GET /api/odds format=raw fails closed when internal auth key is not configured", async () => {
  const originalInternalKey = process.env.EMPIRE_INTERNAL_API_KEY;
  delete process.env.EMPIRE_INTERNAL_API_KEY;

  const response = await GET(
    new Request("http://localhost/api/odds?format=raw", {
      headers: {
        "x-empire-internal-key": "any-value"
      }
    })
  );
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "INTERNAL_AUTH_UNAVAILABLE");

  if (originalInternalKey === undefined) {
    delete process.env.EMPIRE_INTERNAL_API_KEY;
  } else {
    process.env.EMPIRE_INTERNAL_API_KEY = originalInternalKey;
  }
});

test("GET /api/odds sanitizes upstream 5xx details", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => {
    return new Response("upstream secret payload", { status: 500 });
  });

  const originalKey = process.env.ODDS_API_KEY;
  process.env.ODDS_API_KEY = "test-key";

  const response = await GET(new Request("http://localhost/api/odds?sportKey=basketball_nba"));
  const payload = await response.json();

  assert.equal(response.status, 502);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "UPSTREAM_ERROR");
  assert.equal(payload.error.message, "Upstream service unavailable");

  fetchMock.mock.restore();
  if (originalKey === undefined) {
    delete process.env.ODDS_API_KEY;
  } else {
    process.env.ODDS_API_KEY = originalKey;
  }
});
