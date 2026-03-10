import test from "node:test";
import assert from "node:assert/strict";
import { analyzeProbabilityCalibration, buildProbabilityCalibration } from "../lib/server/odds/calibrationAnalysis";
import { resetPersistenceForTests } from "../lib/server/odds/persistence";
import { persistValidationEvent } from "../lib/server/odds/validationStore";
import { persistOutcomeResult } from "../lib/server/odds/outcomes";
import type { PersistedValidationEvent } from "../lib/server/odds/types";

function validationEvent(id: string, sideKey: string, fairProb: number): PersistedValidationEvent {
  return {
    version: 1,
    id,
    createdAt: 1_710_000_000_000,
    sportKey: "basketball_nba",
    eventId: "evt-calibration",
    marketKey: "h2h",
    sideKey,
    commenceTime: "2026-03-01T00:00:00.000Z",
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
      fairProb,
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
      displayedPriceAmerican: -104,
      displayedBookKey: "book-a"
    }
  };
}

test.beforeEach(() => {
  resetPersistenceForTests();
});

test("calibration buckets aggregate expected vs actual win rates", () => {
  const summary = analyzeProbabilityCalibration(
    [
      { fairProb: 0.42, outcome: 1 },
      { fairProb: 0.44, outcome: 0 },
      { fairProb: 0.54, outcome: 1 }
    ],
    0.05
  );

  const firstBucket = summary.buckets.find((bucket) => bucket.bucketLabel === "0.40-0.45");
  assert.ok(firstBucket);
  assert.equal(firstBucket?.sampleSize, 2);
  assert.equal(firstBucket?.expectedWinRate, 0.43);
  assert.equal(firstBucket?.actualWinRate, 0.5);
  assert.ok(Number(summary.brierScore) > 0);
  assert.ok(Number(summary.logLoss) > 0);
  assert.equal(summary.logLoss, summary.meanLogLoss);
});

test("calibration builder ignores events without binary outcomes", async () => {
  await persistValidationEvent(validationEvent("cal-win", "away", 0.52));
  await persistValidationEvent(validationEvent("cal-push", "home", 0.48));

  await persistOutcomeResult({
    sportKey: "basketball_nba",
    eventId: "evt-calibration",
    marketKey: "h2h",
    sideKey: "away",
    result: "win"
  });

  await persistOutcomeResult({
    sportKey: "basketball_nba",
    eventId: "evt-calibration",
    marketKey: "h2h",
    sideKey: "home",
    result: "push"
  });

  const summary = await buildProbabilityCalibration(20);

  assert.equal(summary.sampleSize, 2);
  assert.equal(summary.settledSampleSize, 1);
  assert.equal(summary.buckets.length, 1);
  assert.equal(summary.buckets[0]?.actualWinRate, 1);
});

test("log-loss calculation clamps probabilities to prevent infinity", () => {
  const summary = analyzeProbabilityCalibration([
    { fairProb: 0, outcome: 1 },
    { fairProb: 1, outcome: 0 }
  ]);

  assert.ok(Number.isFinite(summary.logLoss));
  assert.ok((summary.logLoss || 0) > 10);
});

test("confidence tiers follow low/medium/high sample thresholds", () => {
  const low = analyzeProbabilityCalibration(Array.from({ length: 24 }, () => ({ fairProb: 0.55, outcome: 1 })));
  const medium = analyzeProbabilityCalibration(Array.from({ length: 25 }, () => ({ fairProb: 0.55, outcome: 1 })));
  const high = analyzeProbabilityCalibration(Array.from({ length: 100 }, () => ({ fairProb: 0.55, outcome: 1 })));

  assert.equal(low.confidenceTier, "low");
  assert.equal(medium.confidenceTier, "medium");
  assert.equal(high.confidenceTier, "high");
});
