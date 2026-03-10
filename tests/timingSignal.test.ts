import test from "node:test";
import assert from "node:assert/strict";
import { assessTimingSignal } from "../lib/server/odds/timingSignal";
import { DEFAULT_ODDS_CALIBRATION, type OddsCalibration } from "../lib/server/odds/calibration";
import type { ConfidenceAssessment } from "../lib/server/odds/confidence";
import type { FairOutcomeBook } from "../lib/server/odds/types";

function cloneCalibration(): OddsCalibration {
  return JSON.parse(JSON.stringify(DEFAULT_ODDS_CALIBRATION)) as OddsCalibration;
}

function confidence(partial: Partial<ConfidenceAssessment> = {}): ConfidenceAssessment {
  return {
    score: partial.score ?? 0.72,
    label: partial.label ?? "Moderate Confidence",
    notes: partial.notes ?? [],
    coverageRatio: partial.coverageRatio ?? 0.66,
    sharpParticipation: partial.sharpParticipation ?? 0.34,
    freshnessScore: partial.freshnessScore ?? 0.78,
    dispersionScore: partial.dispersionScore ?? 0.7,
    historyQuality: partial.historyQuality ?? 0.7,
    breakdown: partial.breakdown ?? {
      coverageRatio: 0.66,
      sharpParticipation: 0.34,
      freshnessScore: 0.78,
      dispersionScore: 0.7,
      historyQuality: 0.7,
      exclusionPenalty: 0.1,
      componentContributions: {
        coverage: 0.2,
        sharpParticipation: 0.09,
        freshness: 0.16,
        dispersion: 0.1,
        history: 0.06,
        exclusions: 0.04
      }
    }
  };
}

function book(partial: Partial<FairOutcomeBook> = {}): FairOutcomeBook {
  return {
    bookKey: partial.bookKey || "book",
    title: partial.title || "Book",
    tier: partial.tier || "mainstream",
    isSharpBook: partial.isSharpBook ?? false,
    weight: partial.weight ?? 1,
    priceAmerican: partial.priceAmerican ?? -110,
    impliedProb: partial.impliedProb ?? 0.52,
    impliedProbNoVig: partial.impliedProbNoVig ?? 0.5,
    edgePct: partial.edgePct ?? 0.8,
    evPct: partial.evPct ?? 1,
    evQualified: partial.evQualified ?? true,
    evReliability: partial.evReliability ?? "full",
    isBestPrice: partial.isBestPrice ?? false,
    staleStrength: partial.staleStrength ?? 0.4,
    staleFlag: partial.staleFlag ?? "none",
    staleActionable: partial.staleActionable ?? false,
    movement: partial.movement
  };
}

test("timing signal detects single-book holdout", () => {
  const signal = assessTimingSignal({
    books: [
      book({ bookKey: "a", staleActionable: true, staleFlag: "stale_price" }),
      book({ bookKey: "b", staleActionable: false }),
      book({ bookKey: "c", staleActionable: false })
    ],
    confidence: confidence({ score: 0.8 }),
    staleStrength: 0.72,
    movementQuality: "strong",
    movedBooks: 3
  });

  assert.equal(signal.label, "Single-book holdout");
});

test("timing signal suppresses noisy scenarios as weak", () => {
  const signal = assessTimingSignal({
    books: [book(), book()],
    confidence: confidence({ historyQuality: 0.2 }),
    staleStrength: 0.3,
    movementQuality: "weak",
    movedBooks: 0
  });

  assert.equal(signal.label, "Weak timing signal");
});

test("timing thresholds are tunable by calibration", () => {
  const calibration = cloneCalibration();
  calibration.timing.thresholds.likelyClosingUrgency = 0.5;

  const signal = assessTimingSignal({
    books: [book({ staleActionable: true }), book({ staleActionable: true }), book({})],
    confidence: confidence({ score: 0.78 }),
    staleStrength: 0.7,
    movementQuality: "strong",
    movedBooks: 3,
    calibration
  });

  assert.equal(signal.label, "Likely closing");
});
