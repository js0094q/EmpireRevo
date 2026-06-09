import test from "node:test";
import assert from "node:assert/strict";
import { resetPersistenceForTests } from "../lib/server/odds/persistence";
import { persistValidationEvent } from "../lib/server/odds/validationStore";
import { persistOutcomeResult } from "../lib/server/odds/outcomes";
import { buildOutcomeMapForValidationEvents, buildRoiSegmentSummariesFromData, getRoiSummary } from "../lib/server/odds/roiEvaluation";
import type { PersistedValidationEvent } from "../lib/server/odds/types";

function validationEvent(id: string, sideKey: string, price: number): PersistedValidationEvent {
  return {
    version: 1,
    id,
    createdAt: 1_710_000_000_000,
    sportKey: "basketball_nba",
    eventId: "evt-roi",
    marketKey: "h2h",
    sideKey,
    commenceTime: "2026-03-01T00:00:00.000Z",
    point: null,
    bookKey: "book-a",
    snapshotRef: null,
    pinnedContext: {
      pinnedBookKey: null,
      pinnedBestPriceAmerican: null,
      globalBestPriceAmerican: price
    },
    model: {
      fairAmerican: -108,
      fairProb: 0.52,
      rankingScore: 70,
      confidenceScore: 0.7,
      evPct: 2,
      evDefensibility: "full"
    },
    diagnostics: {
      stalePenalty: 0.2,
      timingPenalty: 0.3,
      coveragePenalty: 0.1,
      widthPenalty: null,
      reasons: ["Likely closing"],
      factorBreakdown: { edge: 0.2 }
    },
    execution: {
      displayedPriceAmerican: price,
      displayedBookKey: "book-a"
    }
  };
}

test.beforeEach(() => {
  resetPersistenceForTests();
});

test("roi summary stays null when outcomes are missing", async () => {
  await persistValidationEvent(validationEvent("roi-missing", "away", 110));

  const summary = await getRoiSummary(20);

  assert.equal(summary.sampleSize, 1);
  assert.equal(summary.settledSampleSize, 0);
  assert.equal(summary.roi, null);
  assert.equal(summary.unitsWon, null);
  assert.equal(summary.outcomes.unknown, 1);
});

test("roi summary handles win and push outcomes with flat one-unit stake", async () => {
  await persistValidationEvent(validationEvent("roi-win", "away", 150));
  await persistValidationEvent(validationEvent("roi-push", "home", -110));

  await persistOutcomeResult({
    sportKey: "basketball_nba",
    eventId: "evt-roi",
    marketKey: "h2h",
    sideKey: "away",
    result: "win",
    source: "manual"
  });

  await persistOutcomeResult({
    sportKey: "basketball_nba",
    eventId: "evt-roi",
    marketKey: "h2h",
    sideKey: "home",
    result: "push",
    source: "manual"
  });

  const summary = await getRoiSummary(20);

  assert.equal(summary.sampleSize, 2);
  assert.equal(summary.settledSampleSize, 2);
  assert.equal(summary.outcomes.win, 1);
  assert.equal(summary.outcomes.push, 1);
  assert.equal(summary.unitsWon, 1.5);
  assert.equal(summary.roi, 0.75);
  assert.equal(summary.winRate, 1);
});

test("roi segment summaries group realized results by market and confidence", async () => {
  const win = validationEvent("roi-segment-win", "away", 150);
  const loss = {
    ...validationEvent("roi-segment-loss", "home", -110),
    marketKey: "spread:home",
    model: {
      ...validationEvent("roi-segment-loss", "home", -110).model,
      confidenceScore: 0.42,
      evPct: 1
    }
  };

  await persistValidationEvent(win);
  await persistValidationEvent(loss);
  await persistOutcomeResult({
    sportKey: "basketball_nba",
    eventId: "evt-roi",
    marketKey: "h2h",
    sideKey: "away",
    result: "win",
    source: "manual"
  });
  await persistOutcomeResult({
    sportKey: "basketball_nba",
    eventId: "evt-roi",
    marketKey: "spread:home",
    sideKey: "home",
    result: "loss",
    source: "manual"
  });

  const outcomeMap = await buildOutcomeMapForValidationEvents([win, loss]);
  const byMarket = buildRoiSegmentSummariesFromData([win, loss], outcomeMap, "market");
  const byConfidence = buildRoiSegmentSummariesFromData([win, loss], outcomeMap, "confidence");

  assert.equal(byMarket.find((row) => row.segment === "h2h")?.wins, 1);
  assert.equal(byMarket.find((row) => row.segment === "spread:home")?.losses, 1);
  assert.equal(byConfidence.find((row) => row.segment === "low")?.losses, 1);
});
