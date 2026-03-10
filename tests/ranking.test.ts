import test from "node:test";
import assert from "node:assert/strict";
import { rankOpportunity } from "../lib/server/odds/ranking";
import type { ConfidenceAssessment } from "../lib/server/odds/confidence";
import type { FairOutcomeBook } from "../lib/server/odds/types";

function makeBook(partial: Partial<FairOutcomeBook>): FairOutcomeBook {
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
    evPct: partial.evPct ?? 1.2,
    evQualified: partial.evQualified ?? true,
    isBestPrice: partial.isBestPrice ?? false,
    staleStrength: partial.staleStrength ?? 0.1
  };
}

const highConfidence: ConfidenceAssessment = {
  score: 0.82,
  label: "High Confidence",
  notes: [],
  coverageRatio: 0.8,
  sharpParticipation: 0.45,
  freshnessScore: 0.85,
  dispersionScore: 0.74,
  historyQuality: 0.8,
  breakdown: {
    coverageRatio: 0.8,
    sharpParticipation: 0.45,
    freshnessScore: 0.85,
    dispersionScore: 0.74,
    historyQuality: 0.8,
    exclusionPenalty: 0.1,
    componentContributions: {
      coverage: 0.24,
      sharpParticipation: 0.1,
      freshness: 0.17,
      dispersion: 0.11,
      history: 0.07,
      exclusions: 0.045
    }
  }
};

const thinConfidence: ConfidenceAssessment = {
  score: 0.42,
  label: "Thin Market",
  notes: [],
  coverageRatio: 0.35,
  sharpParticipation: 0.1,
  freshnessScore: 0.6,
  dispersionScore: 0.5,
  historyQuality: 0.3,
  breakdown: {
    coverageRatio: 0.35,
    sharpParticipation: 0.1,
    freshnessScore: 0.6,
    dispersionScore: 0.5,
    historyQuality: 0.3,
    exclusionPenalty: 0.4,
    componentContributions: {
      coverage: 0.1,
      sharpParticipation: 0.02,
      freshness: 0.12,
      dispersion: 0.07,
      history: 0.02,
      exclusions: 0.03
    }
  }
};

test("ranking prefers quality-supported edge over sparse larger edge", () => {
  const quality = rankOpportunity({
    market: "h2h",
    confidence: highConfidence,
    books: [
      makeBook({ bookKey: "pinnacle", title: "Pinnacle", isSharpBook: true, tier: "sharp", edgePct: 1.4, evPct: 3.5, evQualified: true, staleStrength: 0.45 }),
      makeBook({ bookKey: "fanduel", title: "FanDuel", edgePct: 1.1, evPct: 2.2, evQualified: true })
    ],
    contributingBooks: 6,
    totalBooks: 8
  });

  const sparse = rankOpportunity({
    market: "h2h",
    confidence: thinConfidence,
    books: [makeBook({ bookKey: "unknown", title: "Unknown", edgePct: 2.1, evPct: 4.2, staleStrength: 0.2 })],
    contributingBooks: 1,
    totalBooks: 6
  });

  assert.ok(quality.score > sparse.score);
});

test("ranking de-emphasizes EV outside moneyline", () => {
  const spreadRank = rankOpportunity({
    market: "spreads",
    confidence: highConfidence,
    books: [makeBook({ edgePct: 1.2, evPct: 8.5, evQualified: false, staleStrength: 0.2 })],
    contributingBooks: 4,
    totalBooks: 6
  });
  assert.ok(spreadRank.bestEvPct <= 0);
});
