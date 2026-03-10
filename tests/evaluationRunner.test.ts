import test from "node:test";
import assert from "node:assert/strict";
import type { PersistedEvaluationResult, PersistedValidationEvent } from "../lib/server/odds/types";
import { getEvaluationSummary, parseCloseReference, summarizeEvaluationResults } from "../lib/server/odds/evaluationRunner";
import { confidenceTierForSampleSize } from "../lib/server/odds/sampleConfidence";
import { resetPersistenceForTests } from "../lib/server/odds/persistence";
import { persistEvaluationResult, persistValidationEvent } from "../lib/server/odds/validationStore";

function result(id: string, globalBeat: boolean, pinnedBeat: boolean | null): PersistedEvaluationResult {
  return {
    version: 1,
    id,
    validationEventId: `${id}:validation`,
    createdAt: 1_710_000_000_000,
    sportKey: "basketball_nba",
    eventId: "evt-eval",
    marketKey: "h2h:away",
    close: {
      globalBestAmerican: -110,
      pinnedBestAmerican: -109,
      sharpConsensusAmerican: -111,
      fairAmerican: -108
    },
    clv: {
      global: {
        betPriceAmerican: -105,
        closePriceAmerican: -110,
        betImpliedProb: 0.5121951219512195,
        closeImpliedProb: 0.5238095238095238,
        clvProbDelta: globalBeat ? 0.0116144018583043 : -0.0116144018583043,
        beatClose: globalBeat,
        displayAmericanDelta: globalBeat ? 5 : -5,
        clvAmericanDelta: globalBeat ? 5 : -5,
        fairAtBetTime: -108,
        closeReference: "closing_global_best"
      },
      pinned: {
        betPriceAmerican: -105,
        closePriceAmerican: pinnedBeat === null ? null : -109,
        betImpliedProb: 0.5121951219512195,
        closeImpliedProb: pinnedBeat === null ? null : 0.5215311004784688,
        clvProbDelta: pinnedBeat === null ? null : pinnedBeat ? 0.0093359785272493 : -0.0093359785272493,
        beatClose: pinnedBeat,
        displayAmericanDelta: pinnedBeat === null ? null : pinnedBeat ? 4 : -4,
        clvAmericanDelta: pinnedBeat === null ? null : pinnedBeat ? 4 : -4,
        fairAtBetTime: -108,
        closeReference: "closing_pinned_best"
      },
      sharpConsensus: {
        betPriceAmerican: -105,
        closePriceAmerican: -111,
        betImpliedProb: 0.5121951219512195,
        closeImpliedProb: 0.5260663507109005,
        clvProbDelta: 0.013871228759681,
        beatClose: true,
        displayAmericanDelta: 6,
        clvAmericanDelta: 6,
        fairAtBetTime: -108,
        closeReference: "closing_sharp_consensus"
      },
      fair: {
        betPriceAmerican: -105,
        closePriceAmerican: -108,
        betImpliedProb: 0.5121951219512195,
        closeImpliedProb: 0.5192307692307693,
        clvProbDelta: 0.0070356472795498,
        beatClose: true,
        displayAmericanDelta: 3,
        clvAmericanDelta: 3,
        fairAtBetTime: -108,
        closeReference: "closing_fair"
      }
    },
    beatCloseGlobal: globalBeat,
    beatClosePinned: pinnedBeat,
    modelEdgeHeld: true,
    confidenceBucket: globalBeat ? "high" : "low",
    rankingDecile: globalBeat ? 8 : 2,
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

function validationEvent(id: string, createdAt: number): PersistedValidationEvent {
  return {
    version: 1,
    id,
    createdAt,
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
      rankingScore: 70,
      confidenceScore: 0.68,
      evPct: 2,
      evDefensibility: "full"
    },
    diagnostics: {
      stalePenalty: 0.3,
      timingPenalty: 0.2,
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

test("evaluation summary labels close reference and CLV methodology", () => {
  const summary = summarizeEvaluationResults([result("a", true, true), result("b", false, null)], {
    closeReference: "closing_global_best"
  });

  assert.equal(summary.closeReference, "closing_global_best");
  assert.equal(summary.evaluationMethodology.clvSpace, "implied_probability");
  assert.equal(summary.evaluationMethodology.displaySpace, "american_odds");
  assert.equal(summary.evaluationMethodology.roiStakeModel, "flat_unit_stake");
  assert.equal(summary.evaluationMethodology.probabilitySource, "validation_event_fair_probability");
  assert.equal(summary.beatCloseRate, 0.5);
  assert.ok((summary.averageClvProbDelta || 0) < 0.001 && (summary.averageClvProbDelta || 0) > -0.001);
});

test("evaluation summary changes beat-close aggregation by selected close reference", () => {
  const data = [result("a", true, false), result("b", false, null)];
  const globalSummary = summarizeEvaluationResults(data, { closeReference: "closing_global_best" });
  const sharpSummary = summarizeEvaluationResults(data, { closeReference: "closing_sharp_consensus" });

  assert.equal(globalSummary.beatCloseRate, 0.5);
  assert.equal(sharpSummary.beatCloseRate, 1);
});

test("parseCloseReference defaults safely", () => {
  assert.equal(parseCloseReference("closing_fair"), "closing_fair");
  assert.equal(parseCloseReference("invalid"), "closing_global_best");
  assert.equal(parseCloseReference(null), "closing_global_best");
});

test("sample confidence tier thresholds are stable", () => {
  assert.equal(confidenceTierForSampleSize(24), "low");
  assert.equal(confidenceTierForSampleSize(25), "medium");
  assert.equal(confidenceTierForSampleSize(99), "medium");
  assert.equal(confidenceTierForSampleSize(100), "high");
});

test("evaluation summary propagates ROI confidence metadata", () => {
  const summary = summarizeEvaluationResults([result("a", true, true)], {
    closeReference: "closing_global_best",
    roiSummary: {
      sampleSize: 120,
      settledSampleSize: 102,
      confidenceTier: "high",
      roi: 0.04,
      unitsWon: 4.08,
      winRate: 0.55,
      averageEdge: 0.02,
      outcomes: {
        win: 56,
        loss: 46,
        push: 8,
        void: 5,
        unknown: 5
      }
    }
  });

  assert.equal(summary.roiSummary.confidenceTier, "high");
  assert.equal(summary.roiSummary.settledSampleSize, 102);
});

test("getEvaluationSummary preserves sparse cached CLV when missing entries require recomputation", async () => {
  const ts = Date.now() - 60_000;
  await persistValidationEvent(validationEvent("cached-eval", ts));
  await persistValidationEvent(validationEvent("missing-eval", ts - 1_000));

  const cached = result("cached-eval", true, null);
  await persistEvaluationResult({
    ...cached,
    id: "cached-eval:eval",
    validationEventId: "cached-eval",
    eventId: "evt-cached-eval",
    marketKey: "h2h:away"
  });

  const summary = await getEvaluationSummary(20);
  assert.equal(summary.sampleSize, 2);
  assert.equal(summary.averageClvProbDelta, 0.0116144018583043);
});

test("getEvaluationSummary falls back to recomputation when cache is empty", async () => {
  const ts = Date.now() - 60_000;
  await persistValidationEvent(validationEvent("recompute-only", ts));

  const summary = await getEvaluationSummary(20);
  assert.equal(summary.sampleSize, 1);
  assert.equal(summary.averageClvProbDelta, null);
});
