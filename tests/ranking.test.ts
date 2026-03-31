import test from "node:test";
import assert from "node:assert/strict";
import { resetOddsHistoryConfigForTests } from "../lib/server/odds/historyConfig";
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

test.beforeEach(() => {
  delete process.env.ODDS_HISTORY_LIVE_RANKING_MODE;
  resetOddsHistoryConfigForTests();
});

test.after(() => {
  delete process.env.ODDS_HISTORY_LIVE_RANKING_MODE;
  resetOddsHistoryConfigForTests();
});

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

test("ranking penalizes negative sharp deviation", () => {
  const alignedWithSharp = rankOpportunity({
    market: "h2h",
    confidence: highConfidence,
    books: [
      makeBook({ bookKey: "pinnacle", title: "Pinnacle", isSharpBook: true, tier: "sharp", edgePct: 1.5, evPct: 3.2 }),
      makeBook({ bookKey: "fanduel", title: "FanDuel", edgePct: 1.0, evPct: 2.1 })
    ],
    contributingBooks: 6,
    totalBooks: 8
  });

  const sharpAgainst = rankOpportunity({
    market: "h2h",
    confidence: highConfidence,
    books: [
      makeBook({ bookKey: "pinnacle", title: "Pinnacle", isSharpBook: true, tier: "sharp", edgePct: 0.2, evPct: 0.4 }),
      makeBook({ bookKey: "fanduel", title: "FanDuel", edgePct: 1.6, evPct: 3.5 })
    ],
    contributingBooks: 6,
    totalBooks: 8
  });

  assert.ok(alignedWithSharp.score > sharpAgainst.score);
});

test("ranking uses conservative pressure history in live scoring by default", () => {
  const baseline = rankOpportunity({
    market: "h2h",
    confidence: highConfidence,
    books: [
      makeBook({ bookKey: "pinnacle", title: "Pinnacle", isSharpBook: true, tier: "sharp", edgePct: 1.4, evPct: 3.5, evQualified: true, staleStrength: 0.45 }),
      makeBook({ bookKey: "fanduel", title: "FanDuel", edgePct: 1.1, evPct: 2.2, evQualified: true })
    ],
    contributingBooks: 6,
    totalBooks: 8
  });

  const withHistorySignals = rankOpportunity({
    market: "h2h",
    confidence: highConfidence,
    books: [
      makeBook({ bookKey: "pinnacle", title: "Pinnacle", isSharpBook: true, tier: "sharp", edgePct: 1.4, evPct: 3.5, evQualified: true, staleStrength: 0.45 }),
      makeBook({ bookKey: "fanduel", title: "FanDuel", edgePct: 1.1, evPct: 2.2, evQualified: true })
    ],
    contributingBooks: 6,
    totalBooks: 8,
    marketPressure: {
      label: "sharp-up",
      confidence: "high",
      explanation: "Sharp books moved first.",
      evidence: {
        sharpBooksMovedFirst: true,
        observations: 8
      }
    },
    valueTiming: {
      firstPositiveEvAt: "2026-03-01T00:00:00.000Z",
      lastPositiveEvAt: "2026-03-01T00:20:00.000Z",
      positiveEvDurationSeconds: 1200,
      valuePersistence: "stable",
      edgeTrend: "improving"
    }
  });

  assert.equal(withHistorySignals.score, baseline.score + 2);
  assert.ok(withHistorySignals.reasons.includes("Sharp books moved first"));
  assert.deepEqual(withHistorySignals.breakdown.penaltiesApplied, baseline.breakdown.penaltiesApplied);
});

test("ranking keeps value timing out of live scoring in conservative mode", () => {
  const baseline = rankOpportunity({
    market: "h2h",
    confidence: highConfidence,
    books: [
      makeBook({ bookKey: "pinnacle", title: "Pinnacle", isSharpBook: true, tier: "sharp", edgePct: 1.4, evPct: 3.5, evQualified: true, staleStrength: 0.45 }),
      makeBook({ bookKey: "fanduel", title: "FanDuel", edgePct: 1.1, evPct: 2.2, evQualified: true })
    ],
    contributingBooks: 6,
    totalBooks: 8
  });

  const withValueTiming = rankOpportunity({
    market: "h2h",
    confidence: highConfidence,
    books: [
      makeBook({ bookKey: "pinnacle", title: "Pinnacle", isSharpBook: true, tier: "sharp", edgePct: 1.4, evPct: 3.5, evQualified: true, staleStrength: 0.45 }),
      makeBook({ bookKey: "fanduel", title: "FanDuel", edgePct: 1.1, evPct: 2.2, evQualified: true })
    ],
    contributingBooks: 6,
    totalBooks: 8,
    valueTiming: {
      firstPositiveEvAt: "2026-03-01T00:00:00.000Z",
      lastPositiveEvAt: "2026-03-01T00:20:00.000Z",
      positiveEvDurationSeconds: 1200,
      valuePersistence: "stable",
      edgeTrend: "improving"
    }
  });

  assert.equal(withValueTiming.score, baseline.score);
  assert.ok(!withValueTiming.reasons.includes("Positive value has persisted"));
});

test("ranking mode can turn history off or enable full value timing adjustments", () => {
  const params = {
    market: "h2h" as const,
    confidence: highConfidence,
    books: [
      makeBook({ bookKey: "pinnacle", title: "Pinnacle", isSharpBook: true, tier: "sharp", edgePct: 1.4, evPct: 3.5, evQualified: true, staleStrength: 0.45 }),
      makeBook({ bookKey: "fanduel", title: "FanDuel", edgePct: 1.1, evPct: 2.2, evQualified: true })
    ],
    contributingBooks: 6,
    totalBooks: 8,
    marketPressure: {
      label: "sharp-up" as const,
      confidence: "high" as const,
      explanation: "Sharp books moved first.",
      evidence: {
        sharpBooksMovedFirst: true,
        observations: 8
      }
    },
    valueTiming: {
      firstPositiveEvAt: "2026-03-01T00:00:00.000Z",
      lastPositiveEvAt: "2026-03-01T00:20:00.000Z",
      positiveEvDurationSeconds: 1200,
      valuePersistence: "stable" as const,
      edgeTrend: "improving" as const
    }
  };

  process.env.ODDS_HISTORY_LIVE_RANKING_MODE = "off";
  resetOddsHistoryConfigForTests();
  const off = rankOpportunity(params);

  process.env.ODDS_HISTORY_LIVE_RANKING_MODE = "full";
  resetOddsHistoryConfigForTests();
  const full = rankOpportunity(params);

  assert.ok(full.score > off.score);
  assert.ok(full.reasons.includes("Positive value has persisted"));
});

test("ranking penalizes when sharp books disagree with displayed edge", () => {
  const aligned = rankOpportunity({
    market: "h2h",
    confidence: highConfidence,
    books: [
      makeBook({ bookKey: "pinnacle", title: "Pinnacle", isSharpBook: true, tier: "sharp", edgePct: 1.5, evPct: 2.5, evQualified: true, staleStrength: 0.2 }),
      makeBook({ bookKey: "fanduel", title: "FanDuel", edgePct: 1.1, evPct: 2.2, evQualified: true, staleStrength: 0.2 })
    ],
    contributingBooks: 6,
    totalBooks: 8
  });

  const disagreeing = rankOpportunity({
    market: "h2h",
    confidence: highConfidence,
    books: [
      makeBook({ bookKey: "pinnacle", title: "Pinnacle", isSharpBook: true, tier: "sharp", edgePct: 0.3, evPct: 1.4, evQualified: true, staleStrength: 0.2 }),
      makeBook({ bookKey: "fanduel", title: "FanDuel", edgePct: 1.4, evPct: 2.6, evQualified: true, staleStrength: 0.2 })
    ],
    contributingBooks: 6,
    totalBooks: 8
  });

  assert.ok(disagreeing.score < aligned.score);
});
