import test from "node:test";
import assert from "node:assert/strict";
import { resetPersistenceForTests } from "../lib/server/odds/persistence";
import { persistEvaluationResult, persistValidationEvent } from "../lib/server/odds/validationStore";
import { persistOutcomeResult } from "../lib/server/odds/outcomes";
import { buildEvaluationReports } from "../lib/server/odds/evaluationReport";
import type { PersistedEvaluationResult, PersistedValidationEvent } from "../lib/server/odds/types";

function validationEvent(id: string, eventId: string, sideKey: string, createdAt: number): PersistedValidationEvent {
  return {
    version: 1,
    id,
    createdAt,
    sportKey: "basketball_nba",
    eventId,
    marketKey: "h2h",
    sideKey,
    commenceTime: "2026-03-01T00:00:00.000Z",
    point: null,
    bookKey: "book-a",
    snapshotRef: null,
    pinnedContext: {
      pinnedBookKey: null,
      pinnedBestPriceAmerican: null,
      globalBestPriceAmerican: 110
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
      stalePenalty: 0.4,
      timingPenalty: 0.2,
      coveragePenalty: 0.1,
      widthPenalty: null,
      reasons: ["Likely closing"],
      factorBreakdown: {
        edge: 0.2,
        confidence: 0.14,
        sharpParticipation: 0.3
      }
    },
    execution: {
      displayedPriceAmerican: 110,
      displayedBookKey: "book-a"
    }
  };
}

function evaluation(id: string, eventId: string, beat: boolean, createdAt: number): PersistedEvaluationResult {
  return {
    version: 1,
    id: `${id}:eval`,
    validationEventId: id,
    createdAt,
    sportKey: "basketball_nba",
    eventId,
    marketKey: "h2h",
    close: {
      globalBestAmerican: -108,
      pinnedBestAmerican: null,
      sharpConsensusAmerican: -109,
      fairAmerican: -108
    },
    clv: {
      global: {
        betPriceAmerican: 110,
        closePriceAmerican: -108,
        betImpliedProb: 0.47619047619047616,
        closeImpliedProb: 0.5192307692307693,
        clvProbDelta: beat ? 0.04304029304029317 : -0.04304029304029317,
        fairAtBetTime: -108,
        displayAmericanDelta: beat ? 218 : -218,
        clvAmericanDelta: beat ? 218 : -218,
        beatClose: beat,
        closeReference: "closing_global_best"
      },
      pinned: {
        betPriceAmerican: 110,
        closePriceAmerican: null,
        betImpliedProb: 0.47619047619047616,
        closeImpliedProb: null,
        clvProbDelta: null,
        fairAtBetTime: -108,
        displayAmericanDelta: null,
        clvAmericanDelta: null,
        beatClose: null,
        closeReference: "closing_pinned_best"
      },
      sharpConsensus: {
        betPriceAmerican: 110,
        closePriceAmerican: -109,
        betImpliedProb: 0.47619047619047616,
        closeImpliedProb: 0.5215311004784688,
        clvProbDelta: 0.0453406242879927,
        fairAtBetTime: -108,
        displayAmericanDelta: 219,
        clvAmericanDelta: 219,
        beatClose: true,
        closeReference: "closing_sharp_consensus"
      },
      fair: {
        betPriceAmerican: 110,
        closePriceAmerican: -108,
        betImpliedProb: 0.47619047619047616,
        closeImpliedProb: 0.5192307692307693,
        clvProbDelta: 0.04304029304029317,
        fairAtBetTime: -108,
        displayAmericanDelta: 218,
        clvAmericanDelta: 218,
        beatClose: true,
        closeReference: "closing_fair"
      }
    },
    beatCloseGlobal: beat,
    beatClosePinned: null,
    modelEdgeHeld: beat,
    confidenceBucket: "medium",
    rankingDecile: 7,
    evDefensibility: "full",
    methodology: {
      closeReference: "closing_global_best",
      clvSpace: "implied_probability",
      displaySpace: "american_odds",
      roiStakeModel: "flat_unit_stake",
      probabilitySource: "validation_event_fair_probability",
      isDefaultCloseReference: true
    }
  };
}

test.beforeEach(() => {
  resetPersistenceForTests();
});

test("evaluation reports provide daily, weekly, rolling-30, and rolling-90 windows", async () => {
  const now = Date.now();
  const twoHoursAgo = now - 2 * 60 * 60 * 1000;
  const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
  const seventyDaysAgo = now - 70 * 24 * 60 * 60 * 1000;
  const oneTwentyDaysAgo = now - 120 * 24 * 60 * 60 * 1000;

  await persistValidationEvent(validationEvent("report-1", "evt-report-1", "away", twoHoursAgo));
  await persistValidationEvent(validationEvent("report-2", "evt-report-2", "home", threeDaysAgo));
  await persistValidationEvent(validationEvent("report-3", "evt-report-3", "away", seventyDaysAgo));
  await persistValidationEvent(validationEvent("report-4", "evt-report-4", "home", oneTwentyDaysAgo));

  await persistEvaluationResult(evaluation("report-1", "evt-report-1", true, twoHoursAgo));
  await persistEvaluationResult(evaluation("report-2", "evt-report-2", false, threeDaysAgo));
  await persistEvaluationResult(evaluation("report-3", "evt-report-3", true, seventyDaysAgo));
  await persistEvaluationResult(evaluation("report-4", "evt-report-4", false, oneTwentyDaysAgo));

  await persistOutcomeResult({
    sportKey: "basketball_nba",
    eventId: "evt-report-1",
    marketKey: "h2h",
    sideKey: "away",
    result: "win"
  });

  await persistOutcomeResult({
    sportKey: "basketball_nba",
    eventId: "evt-report-2",
    marketKey: "h2h",
    sideKey: "home",
    result: "loss"
  });

  await persistOutcomeResult({
    sportKey: "basketball_nba",
    eventId: "evt-report-3",
    marketKey: "h2h",
    sideKey: "away",
    result: "unknown"
  });

  await persistOutcomeResult({
    sportKey: "basketball_nba",
    eventId: "evt-report-4",
    marketKey: "h2h",
    sideKey: "home",
    result: "win"
  });

  const reports = await buildEvaluationReports(100, { nowMs: now });

  assert.equal(reports.windows.length, 4);
  assert.equal(reports.evaluationMethodology.roiStakeModel, "flat_unit_stake");
  assert.equal(reports.evaluationMethodology.probabilitySource, "validation_event_fair_probability");

  const daily = reports.windows.find((window) => window.window === "daily");
  const weekly = reports.windows.find((window) => window.window === "weekly");
  const rolling30 = reports.windows.find((window) => window.window === "rolling30d");
  const rolling90 = reports.windows.find((window) => window.window === "rolling90d");

  assert.equal(daily?.sampleSize, 1);
  assert.equal(weekly?.sampleSize, 2);
  assert.equal(rolling30?.sampleSize, 2);
  assert.equal(rolling90?.sampleSize, 3);
  assert.equal(rolling90?.settledSampleSize, 2);
  assert.equal(rolling90?.confidenceTier, "low");

  assert.ok(weekly?.clvPerformance.confidenceIntervals.beatCloseRate);
  assert.ok(weekly?.roiPerformance.confidenceIntervals.winRate);
  assert.ok(weekly?.probabilityCalibration.sampleSize >= 1);
});
