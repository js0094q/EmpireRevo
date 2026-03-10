import test from "node:test";
import assert from "node:assert/strict";
import { resetPersistenceForTests } from "../lib/server/odds/persistence";
import { buildFactorAnalytics } from "../lib/server/odds/factorAnalytics";
import { persistEvaluationResult, persistValidationEvent } from "../lib/server/odds/validationStore";
import type { PersistedEvaluationResult, PersistedValidationEvent } from "../lib/server/odds/types";

function validation(id: string, score: number, confidence: number, reasons: string[]): PersistedValidationEvent {
  return {
    version: 1,
    id,
    createdAt: 1_710_000_000_000,
    sportKey: "basketball_nba",
    eventId: `evt-${id}`,
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
      rankingScore: score,
      confidenceScore: confidence,
      evPct: 2.1,
      evDefensibility: "full"
    },
    diagnostics: {
      stalePenalty: 0.3,
      timingPenalty: 0.2,
      coveragePenalty: 0.1,
      widthPenalty: null,
      reasons,
      factorBreakdown: {
        edge: score / 100,
        confidence
      }
    },
    execution: {
      displayedPriceAmerican: -104,
      displayedBookKey: "book-a"
    }
  };
}

function evaluation(id: string, beat: boolean): PersistedEvaluationResult {
  return {
    version: 1,
    id: `${id}:eval`,
    validationEventId: id,
    createdAt: 1_710_000_000_000,
    sportKey: "basketball_nba",
    eventId: `evt-${id}`,
    marketKey: "h2h:away",
    close: {
      globalBestAmerican: -108,
      pinnedBestAmerican: null,
      sharpConsensusAmerican: -109,
      fairAmerican: -108
    },
    clv: {
      global: {
        betPriceAmerican: -104,
        closePriceAmerican: -108,
        betImpliedProb: 0.5098039215686274,
        closeImpliedProb: 0.5192307692307693,
        clvProbDelta: beat ? 0.0094268476621419 : -0.0094268476621419,
        fairAtBetTime: -108,
        displayAmericanDelta: beat ? 4 : -4,
        clvAmericanDelta: beat ? 4 : -4,
        beatClose: beat,
        closeReference: "closing_global_best"
      },
      pinned: {
        betPriceAmerican: -104,
        closePriceAmerican: null,
        betImpliedProb: 0.5098039215686274,
        closeImpliedProb: null,
        clvProbDelta: null,
        fairAtBetTime: -108,
        displayAmericanDelta: null,
        clvAmericanDelta: null,
        beatClose: null,
        closeReference: "closing_pinned_best"
      },
      sharpConsensus: {
        betPriceAmerican: -104,
        closePriceAmerican: -109,
        betImpliedProb: 0.5098039215686274,
        closeImpliedProb: 0.5215311004784688,
        clvProbDelta: 0.0117271789098414,
        fairAtBetTime: -108,
        displayAmericanDelta: 5,
        clvAmericanDelta: 5,
        beatClose: true,
        closeReference: "closing_sharp_consensus"
      },
      fair: {
        betPriceAmerican: -104,
        closePriceAmerican: -108,
        betImpliedProb: 0.5098039215686274,
        closeImpliedProb: 0.5192307692307693,
        clvProbDelta: 0.0094268476621419,
        fairAtBetTime: -108,
        displayAmericanDelta: 4,
        clvAmericanDelta: 4,
        beatClose: true,
        closeReference: "closing_fair"
      }
    },
    beatCloseGlobal: beat,
    beatClosePinned: null,
    modelEdgeHeld: beat,
    confidenceBucket: beat ? "high" : "low",
    rankingDecile: beat ? 8 : 3,
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

test("factor analytics aggregates factor and penalty correlations", async () => {
  await persistValidationEvent(validation("one", 82, 0.78, ["Sparse market coverage"]));
  await persistValidationEvent(validation("two", 38, 0.49, ["Sparse market coverage", "Weak confidence label"]));
  await persistEvaluationResult(evaluation("one", true));
  await persistEvaluationResult(evaluation("two", false));

  const summary = await buildFactorAnalytics(50);

  assert.equal(summary.sampleSize, 2);
  assert.equal(summary.evaluatedSampleSize, 2);
  assert.ok(summary.factorContributions.some((row) => row.factor === "edge"));
  assert.ok(summary.penaltyCorrelations.some((row) => row.reason === "Sparse market coverage"));
  assert.equal(summary.pressureVsCLV.length, 3);
  assert.equal(summary.pressureVsROI.length, 3);
  assert.equal(summary.pressureVsTiming.length, 3);
});
