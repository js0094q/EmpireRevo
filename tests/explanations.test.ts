import test from "node:test";
import assert from "node:assert/strict";
import { buildOpportunityExplanation } from "../lib/server/odds/explanations";
import type { ConfidenceAssessment } from "../lib/server/odds/confidence";
import type { OpportunityRanking } from "../lib/server/odds/ranking";
import type { FairOutcomeBook } from "../lib/server/odds/types";

const moderate: ConfidenceAssessment = {
  score: 0.62,
  label: "Moderate Confidence",
  notes: [],
  coverageRatio: 0.65,
  sharpParticipation: 0.3,
  freshnessScore: 0.7,
  dispersionScore: 0.7,
  historyQuality: 0.65,
  breakdown: {
    coverageRatio: 0.65,
    sharpParticipation: 0.3,
    freshnessScore: 0.7,
    dispersionScore: 0.7,
    historyQuality: 0.65,
    exclusionPenalty: 0,
    componentContributions: {
      coverage: 0.2,
      sharpParticipation: 0.15,
      freshness: 0.14,
      dispersion: 0.1,
      history: 0.05,
      exclusions: 0.05
    }
  }
};

const thin: ConfidenceAssessment = {
  score: 0.38,
  label: "Thin Market",
  notes: [],
  coverageRatio: 0.3,
  sharpParticipation: 0.1,
  freshnessScore: 0.6,
  dispersionScore: 0.5,
  historyQuality: 0.3,
  breakdown: {
    coverageRatio: 0.3,
    sharpParticipation: 0.1,
    freshnessScore: 0.6,
    dispersionScore: 0.5,
    historyQuality: 0.3,
    exclusionPenalty: 0.3,
    componentContributions: {
      coverage: 0.09,
      sharpParticipation: 0.03,
      freshness: 0.12,
      dispersion: 0.08,
      history: 0.02,
      exclusions: 0.03
    }
  }
};

const ranking: OpportunityRanking = {
  score: 68.4,
  confidenceAdjustedEdge: 0.9,
  bestEdgePct: 1.2,
  bestEvPct: 2.1,
  bestBookKey: "fanduel",
  staleStrength: 0.66,
  sharpDeviation: 1.3,
  reasons: [],
  breakdown: {
    edgeScore: 0.45,
    evScore: 0.3,
    confidenceScore: 0.62,
    coverageScore: 0.65,
    sharpScore: 0.3,
    freshnessScore: 0.7,
    staleScore: 0.66,
    deviationScore: 0.52,
    componentContributions: {
      edge: 0.1,
      ev: 0.05,
      confidence: 0.12,
      coverage: 0.08,
      sharpParticipation: 0.03,
      freshness: 0.04,
      stale: 0.03,
      sharpDeviation: 0.02
    },
    penaltiesApplied: []
  }
};

const books: FairOutcomeBook[] = [
  {
    bookKey: "fanduel",
    title: "FanDuel",
    tier: "mainstream",
    isSharpBook: false,
    weight: 1,
    priceAmerican: -102,
    impliedProb: 0.505,
    impliedProbNoVig: 0.49,
    edgePct: 1.2,
    evPct: 2.1,
    evQualified: true,
    isBestPrice: true
  }
];

test("explanations mention thin coverage deterministically", () => {
  const text = buildOpportunityExplanation({
    outcomeName: "Boston Celtics",
    confidence: thin,
    ranking,
    books,
    staleSummary: "Stale price",
    timingSignal: { label: "Weak timing signal", urgencyScore: 0.3, reasons: ["test"] }
  });
  assert.match(text, /coverage is thin/i);
});

test("explanations mention stale signal when present", () => {
  const text = buildOpportunityExplanation({
    outcomeName: "Boston Celtics",
    confidence: moderate,
    ranking,
    books,
    staleSummary: "Lagging book",
    timingSignal: { label: "Likely closing", urgencyScore: 0.8, reasons: ["test"] }
  });
  assert.match(text, /lagging book|stale/i);
});
