import test from "node:test";
import assert from "node:assert/strict";
import type { PersistedEvaluationResult, PersistedValidationEvent } from "../lib/server/odds/types";
import { resetPersistenceForTests } from "../lib/server/odds/persistence";
import {
  getClosingEvaluation,
  getValidationEvent,
  listEvaluationResults,
  listValidationEvents,
  persistEvaluationResult,
  persistValidationEvent
} from "../lib/server/odds/validationStore";

function validationEvent(id: string, createdAt: number): PersistedValidationEvent {
  return {
    version: 1,
    id,
    createdAt,
    sportKey: "basketball_nba",
    eventId: "evt-store",
    marketKey: "h2h:away",
    sideKey: "away",
    commenceTime: "2026-03-01T00:00:00.000Z",
    point: null,
    bookKey: "fanduel",
    snapshotRef: {
      key: "snapshot-key",
      bucketTs: createdAt
    },
    pinnedContext: {
      pinnedBookKey: null,
      globalBestPriceAmerican: -104,
      pinnedBestPriceAmerican: null
    },
    model: {
      fairAmerican: -108,
      fairProb: 0.52,
      rankingScore: 71,
      confidenceScore: 0.74,
      evPct: 2.1,
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
      displayedBookKey: "fanduel"
    }
  };
}

function evaluationResult(id: string, createdAt: number): PersistedEvaluationResult {
  return {
    version: 1,
    id,
    validationEventId: "validation-1",
    createdAt,
    sportKey: "basketball_nba",
    eventId: "evt-store",
    marketKey: "h2h:away",
    close: {
      globalBestAmerican: -110,
      pinnedBestAmerican: null,
      sharpConsensusAmerican: -111,
      fairAmerican: -109
    },
    clv: {
      global: {
        betPriceAmerican: -104,
        closePriceAmerican: -110,
        betImpliedProb: 0.5098039215686274,
        closeImpliedProb: 0.5238095238095238,
        clvProbDelta: 0.0140056022408964,
        fairAtBetTime: -108,
        displayAmericanDelta: 6,
        clvAmericanDelta: 6,
        beatClose: true,
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
        closePriceAmerican: -111,
        betImpliedProb: 0.5098039215686274,
        closeImpliedProb: 0.5260663507109005,
        clvProbDelta: 0.0162624291422731,
        fairAtBetTime: -108,
        displayAmericanDelta: 7,
        clvAmericanDelta: 7,
        beatClose: true,
        closeReference: "closing_sharp_consensus"
      },
      fair: {
        betPriceAmerican: -104,
        closePriceAmerican: -109,
        betImpliedProb: 0.5098039215686274,
        closeImpliedProb: 0.5215311004784688,
        clvProbDelta: 0.0117271789098414,
        fairAtBetTime: -108,
        displayAmericanDelta: 5,
        clvAmericanDelta: 5,
        beatClose: true,
        closeReference: "closing_fair"
      }
    },
    beatCloseGlobal: true,
    beatClosePinned: null,
    modelEdgeHeld: true,
    confidenceBucket: "high",
    rankingDecile: 8,
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

test("validation store persists and indexes events", async () => {
  const event = validationEvent("validation-1", 1_710_000_000_000);
  await persistValidationEvent(event);

  const stored = await getValidationEvent("validation-1");
  assert.ok(stored);
  assert.equal(stored?.eventId, "evt-store");

  const list = await listValidationEvents(10);
  assert.equal(list.length, 1);
  assert.equal(list[0]?.id, "validation-1");
});

test("validation store persists evaluation and closing summary", async () => {
  await persistEvaluationResult(evaluationResult("eval-1", 1_710_000_000_000));

  const evaluations = await listEvaluationResults(10);
  assert.equal(evaluations.length, 1);
  assert.equal(evaluations[0]?.id, "eval-1");

  const closing = await getClosingEvaluation("basketball_nba", "evt-store", "h2h:away");
  assert.ok(closing);
  assert.equal(closing?.close.globalBestAmerican, -110);
});
