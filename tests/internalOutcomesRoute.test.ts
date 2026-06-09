import test from "node:test";
import assert from "node:assert/strict";
import { GET, POST } from "../app/api/internal/outcomes/route";
import { createMockRedis } from "./mockRedis";
import { resetPersistenceForTests, setRedisOverrideForTests } from "../lib/server/odds/persistence";

const INTERNAL_TEST_KEY = "internal-test-key";

test.beforeEach(() => {
  resetPersistenceForTests();
  setRedisOverrideForTests(null);
  process.env.EMPIRE_INTERNAL_API_KEY = INTERNAL_TEST_KEY;
});

test.after(() => {
  delete process.env.EMPIRE_INTERNAL_API_KEY;
});

test("internal outcomes route rejects unauthenticated writes", async () => {
  const res = await POST(new Request("http://localhost/api/internal/outcomes", { method: "POST" }));
  const payload = await res.json();

  assert.equal(res.status, 401);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "UNAUTHORIZED");
});

test("internal outcomes route records and lists manual results when persistence is durable", async () => {
  const redis = createMockRedis();
  setRedisOverrideForTests(redis.client);

  const res = await POST(
    new Request("http://localhost/api/internal/outcomes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-empire-internal-key": INTERNAL_TEST_KEY
      },
      body: JSON.stringify({
        sportKey: "basketball_nba",
        eventId: "evt-route",
        marketKey: "h2h:away",
        sideKey: "away",
        result: "win",
        finalScore: "112-108"
      })
    })
  );
  const payload = await res.json();

  assert.equal(res.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.outcome.result, "win");
  assert.equal(payload.outcome.finalScore, "112-108");

  const listRes = await GET(
    new Request("http://localhost/api/internal/outcomes", {
      headers: {
        "x-empire-internal-key": INTERNAL_TEST_KEY
      }
    })
  );
  const listPayload = await listRes.json();

  assert.equal(listRes.status, 200);
  assert.equal(listPayload.ok, true);
  assert.equal(listPayload.outcomes.length, 1);
});

test("internal outcomes route validates result enum", async () => {
  const redis = createMockRedis();
  setRedisOverrideForTests(redis.client);

  const res = await POST(
    new Request("http://localhost/api/internal/outcomes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-empire-internal-key": INTERNAL_TEST_KEY
      },
      body: JSON.stringify({
        sportKey: "basketball_nba",
        eventId: "evt-route",
        marketKey: "h2h:away",
        sideKey: "away",
        result: "pending"
      })
    })
  );
  const payload = await res.json();

  assert.equal(res.status, 400);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "INVALID_OUTCOME_PAYLOAD");
});
