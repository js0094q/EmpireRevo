import test from "node:test";
import assert from "node:assert/strict";
import { buildOutcomeSummary, buildPickSummary, marketVsModelCopy } from "../components/board/board-helpers";
import type { FairEvent, FairOutcome, FairOutcomeBook } from "../lib/server/odds/types";

function buildBook(overrides: Partial<FairOutcomeBook>): FairOutcomeBook {
  return {
    bookKey: "book_a",
    title: "Book A",
    tier: "mainstream",
    isSharpBook: false,
    weight: 1,
    priceAmerican: -110,
    impliedProb: 0.5238,
    impliedProbNoVig: 0.5,
    edgePct: 0,
    evPct: 0,
    evQualified: true,
    isBestPrice: true,
    ...overrides
  };
}

function buildOutcome(overrides: Partial<FairOutcome>): FairOutcome {
  return {
    name: "Side A",
    fairProb: 0.5,
    fairAmerican: -100,
    consensusDirection: "neutral",
    bestPrice: -100,
    bestBook: "Book A",
    opportunityScore: 45,
    confidenceScore: 0.7,
    confidenceLabel: "Moderate Confidence",
    confidenceNotes: [],
    staleStrength: 0.2,
    staleSummary: "In line",
    sharpParticipationPct: 0.25,
    movementSummary: "Mixed movement",
    movementQuality: "weak",
    timingSignal: { label: "Weak timing signal", urgencyScore: 0.2, reasons: ["test"] },
    sharpDeviation: 0.1,
    explanation: "test explanation",
    pinnedActionability: {
      bestPinnedBookKey: null,
      bestPinnedBookTitle: null,
      bestPinnedEdgePct: 0,
      bestPinnedEvPct: 0,
      pinnedStaleStrength: 0,
      pinnedScore: 0,
      actionable: false,
      globalBestBookKey: "book_a",
      globalBestBookTitle: "Book A",
      globalBestEdgePct: 0,
      globalPriceAvailableInPinned: false
    },
    evReliability: "full",
    books: [buildBook({})],
    ...overrides
  };
}

function buildEvent(outcome: FairOutcome): FairEvent {
  return {
    id: "evt-1",
    baseEventId: "evt-1",
    commenceTime: "2026-03-10T00:00:00.000Z",
    homeTeam: "Home",
    awayTeam: "Away",
    sportKey: "basketball_nba",
    market: "h2h",
    bookCount: 1,
    contributingBookCount: 1,
    totalBookCount: 1,
    maxAbsEdgePct: Math.abs(outcome.books[0]?.edgePct ?? 0),
    opportunityScore: outcome.opportunityScore,
    confidenceScore: outcome.confidenceScore,
    confidenceLabel: outcome.confidenceLabel,
    staleStrength: outcome.staleStrength,
    timingLabel: outcome.timingSignal.label,
    rankingSummary: outcome.explanation,
    excludedBooks: [],
    outcomes: [outcome]
  };
}

test("worse favorite price is labeled as model lean, not best value", () => {
  const favoriteOutcome = buildOutcome({
    name: "Favorite Side",
    fairProb: 0.8721,
    fairAmerican: -682,
    consensusDirection: "favored",
    books: [
      buildBook({
        priceAmerican: -800,
        impliedProbNoVig: 0.842,
        edgePct: 3.01,
        marketPriceAmerican: -800,
        fairPriceAmerican: -682,
        marketImpliedProb: 0.842,
        fairImpliedProb: 0.8721
      })
    ]
  });

  const summary = buildOutcomeSummary(favoriteOutcome);
  const explanation = marketVsModelCopy({
    market: "h2h",
    outcome: favoriteOutcome,
    book: favoriteOutcome.books[0]!
  });

  assert.equal(summary.label, "Model Lean");
  assert.equal(summary.hasRecommendation, false);
  assert.match(explanation, /charging more juice/i);
  assert.doesNotMatch(explanation, /favorable pricing/i);
  assert.doesNotMatch(explanation, /better price than fair/i);
  assert.doesNotMatch(explanation, /best value/i);
});

test("better underdog price can remain better-than-fair without best-value promotion", () => {
  const underdogOutcome = buildOutcome({
    name: "Underdog Side",
    fairProb: 0.4292,
    fairAmerican: 133,
    consensusDirection: "underdog",
    books: [
      buildBook({
        priceAmerican: 135,
        impliedProbNoVig: 0.423,
        edgePct: 0.62,
        marketPriceAmerican: 135,
        fairPriceAmerican: 133,
        marketImpliedProb: 0.423,
        fairImpliedProb: 0.4292
      })
    ]
  });

  const summary = buildOutcomeSummary(underdogOutcome);
  const explanation = marketVsModelCopy({
    market: "h2h",
    outcome: underdogOutcome,
    book: underdogOutcome.books[0]!
  });

  assert.equal(summary.label, "Better Than Fair");
  assert.equal(summary.hasRecommendation, true);
  assert.match(explanation, /better price than fair/i);
});

test("event-level recommendation label follows price-vs-fair direction", () => {
  const favoriteOutcome = buildOutcome({
    name: "Favorite Side",
    fairProb: 0.8721,
    fairAmerican: -682,
    consensusDirection: "favored",
    opportunityScore: 90,
    books: [
      buildBook({
        priceAmerican: -800,
        impliedProbNoVig: 0.842,
        edgePct: 3.01,
        marketPriceAmerican: -800,
        fairPriceAmerican: -682,
        marketImpliedProb: 0.842,
        fairImpliedProb: 0.8721
      })
    ]
  });

  const summary = buildPickSummary(buildEvent(favoriteOutcome));
  assert.equal(summary.label, "Model Lean");
});

test("longshot better-than-fair profile uses longshot price advantage badge", () => {
  const longshotOutcome = buildOutcome({
    name: "Longshot Side",
    fairProb: 0.1053,
    fairAmerican: 848,
    consensusDirection: "underdog",
    books: [
      buildBook({
        priceAmerican: 950,
        impliedProbNoVig: 0.09,
        edgePct: 1.53,
        marketPriceAmerican: 950,
        fairPriceAmerican: 848,
        marketImpliedProb: 0.09,
        fairImpliedProb: 0.1053
      })
    ]
  });

  const summary = buildOutcomeSummary(longshotOutcome);
  const explanation = marketVsModelCopy({
    market: "h2h",
    outcome: longshotOutcome,
    book: longshotOutcome.books[0]!
  });

  assert.equal(summary.label, "Longshot Price Advantage");
  assert.notEqual(summary.label, "Best Value");
  assert.match(explanation, /longshot|thin/i);
});
