import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/internal/diagnostics/route";
import { createMockRedis } from "./mockRedis";
import { resetPersistenceForTests, setRedisOverrideForTests } from "../lib/server/odds/persistence";
import { persistValidationEvent } from "../lib/server/odds/validationStore";
import type { PersistedValidationEvent } from "../lib/server/odds/types";

const INTERNAL_TEST_KEY = "internal-test-key";

function event(id: string): PersistedValidationEvent {
  return {
    version: 1,
    id,
    createdAt: 1_700_000_000_000,
    sportKey: "basketball_nba",
    eventId: "evt-route",
    marketKey: "h2h:away",
    sideKey: "away",
    commenceTime: "2025-01-01T00:00:00.000Z",
    point: null,
    bookKey: "book-a",
    snapshotRef: null,
    pinnedContext: {
      pinnedBookKey: null,
      pinnedBestPriceAmerican: null,
      globalBestPriceAmerican: -104
    },
    model: {
      fairAmerican: -108,
      fairProb: 0.52,
      rankingScore: 70,
      confidenceScore: 0.72,
      evPct: 2,
      evDefensibility: "full"
    },
    diagnostics: {
      stalePenalty: 0.3,
      timingPenalty: 0.2,
      coveragePenalty: 0.1,
      widthPenalty: null,
      reasons: ["Sparse market coverage"],
      factorBreakdown: {
        edge: 0.2,
        confidence: 0.14
      }
    },
    execution: {
      displayedPriceAmerican: -104,
      displayedBookKey: "book-a"
    }
  };
}

test.beforeEach(() => {
  resetPersistenceForTests();
  setRedisOverrideForTests(null);
  process.env.EMPIRE_INTERNAL_API_KEY = INTERNAL_TEST_KEY;
});

test.after(() => {
  delete process.env.EMPIRE_INTERNAL_API_KEY;
});

test("internal diagnostics route rejects unauthenticated requests", async () => {
  const res = await GET(new Request("http://localhost/api/internal/diagnostics"));
  const payload = await res.json();

  assert.equal(res.status, 401);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "UNAUTHORIZED");
});

test("internal diagnostics route fails closed when internal auth key is missing", async () => {
  delete process.env.EMPIRE_INTERNAL_API_KEY;

  const res = await GET(
    new Request("http://localhost/api/internal/diagnostics", {
      headers: {
        "x-empire-internal-key": INTERNAL_TEST_KEY
      }
    })
  );
  const payload = await res.json();

  assert.equal(res.status, 503);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "INTERNAL_AUTH_UNAVAILABLE");
});

test("internal diagnostics route returns persistence unavailable with valid internal auth", async () => {
  const res = await GET(
    new Request("http://localhost/api/internal/diagnostics", {
      headers: {
        "x-empire-internal-key": INTERNAL_TEST_KEY
      }
    })
  );
  const payload = await res.json();

  assert.equal(res.status, 503);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "PERSISTENCE_UNAVAILABLE");
  assert.ok(payload.persistenceHealth);
});

test("internal diagnostics route accepts internal session cookie auth", async () => {
  const res = await GET(
    new Request("http://localhost/api/internal/diagnostics", {
      headers: {
        cookie: "empire_internal_session=internal-test-key"
      }
    })
  );
  const payload = await res.json();

  assert.equal(res.status, 503);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "PERSISTENCE_UNAVAILABLE");
});

test("internal diagnostics route returns stable JSON when persistence is available", async () => {
  const redis = createMockRedis();
  setRedisOverrideForTests(redis.client);
  await persistValidationEvent(event("validation-route-1"));

  const res = await GET(
    new Request("http://localhost/api/internal/diagnostics", {
      headers: {
        "x-empire-internal-key": INTERNAL_TEST_KEY
      }
    })
  );
  const payload = await res.json();

  assert.equal(res.status, 200);
  assert.equal(payload.ok, true);
  assert.ok(payload.persistenceHealth);
  assert.ok(payload.validation);
  assert.ok(payload.factorAnalytics);
  assert.ok(payload.evaluation);
  assert.ok(payload.roiSummary);
  assert.ok(payload.probabilityCalibration);
  assert.ok(payload.factorPerformance);
  assert.ok(payload.evaluationReports);
  assert.ok(payload.probabilityCalibration.logLoss !== undefined);
  assert.ok(payload.roiSummary.confidenceTier);
  assert.ok(payload.factorPerformance.confidenceTier);
});
