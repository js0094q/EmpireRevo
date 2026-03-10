import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/internal/diagnostics/route";
import { createMockRedis } from "./mockRedis";
import { resetPersistenceForTests, setRedisOverrideForTests } from "../lib/server/odds/persistence";
import { persistValidationEvent } from "../lib/server/odds/validationStore";
import type { PersistedValidationEvent } from "../lib/server/odds/types";

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
});

test("internal diagnostics route fails closed when durable persistence unavailable", async () => {
  const res = await GET(new Request("http://localhost/api/internal/diagnostics"));
  const payload = await res.json();

  assert.equal(res.status, 503);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "PERSISTENCE_UNAVAILABLE");
  assert.ok(payload.persistenceHealth);
});

test("internal diagnostics route returns stable JSON when persistence is available", async () => {
  const redis = createMockRedis();
  setRedisOverrideForTests(redis.client);
  await persistValidationEvent(event("validation-route-1"));

  const res = await GET(new Request("http://localhost/api/internal/diagnostics"));
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
