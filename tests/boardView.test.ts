import test from "node:test";
import assert from "node:assert/strict";
import type { FairBoardResponse, FairEvent, FairOutcome, FairOutcomeBook } from "../lib/server/odds/types";
import { buildBoardDrilldownRows } from "../lib/server/odds/boardView";

function makeBook(params: {
  bookKey: string;
  title: string;
  priceAmerican: number;
  fairPriceAmerican: number;
  impliedProbNoVig: number;
  edgePct: number;
  evPct: number;
  isBestPrice: boolean;
}): FairOutcomeBook {
  return {
    bookKey: params.bookKey,
    title: params.title,
    tier: "mainstream",
    isSharpBook: false,
    weight: 1,
    priceAmerican: params.priceAmerican,
    fairPriceAmerican: params.fairPriceAmerican,
    marketPriceAmerican: params.priceAmerican,
    priceDeltaAmerican: params.priceAmerican - params.fairPriceAmerican,
    marketImpliedProb: 0.5,
    fairImpliedProb: 0.5,
    probabilityGapPct: 0,
    priceValueDirection: "near_fair",
    impliedProb: 0.5,
    impliedProbNoVig: params.impliedProbNoVig,
    edgePct: params.edgePct,
    evPct: params.evPct,
    evQualified: true,
    evReliability: "full",
    isBestPrice: params.isBestPrice
  };
}

function makeOutcome(params: {
  name: string;
  fairAmerican: number;
  bestBook: string;
  bestPrice: number;
  secondBook: string;
  secondPrice: number;
}): FairOutcome {
  const books = [
    makeBook({
      bookKey: params.bestBook.toLowerCase().replace(/[^a-z0-9]+/g, ""),
      title: params.bestBook,
      priceAmerican: params.bestPrice,
      fairPriceAmerican: params.fairAmerican,
      impliedProbNoVig: 0.52,
      edgePct: 2.1,
      evPct: 3.4,
      isBestPrice: true
    }),
    makeBook({
      bookKey: params.secondBook.toLowerCase().replace(/[^a-z0-9]+/g, ""),
      title: params.secondBook,
      priceAmerican: params.secondPrice,
      fairPriceAmerican: params.fairAmerican,
      impliedProbNoVig: 0.48,
      edgePct: -1.1,
      evPct: -0.6,
      isBestPrice: false
    })
  ];

  return {
    name: params.name,
    fairProb: 0.5,
    fairAmerican: params.fairAmerican,
    consensusDirection: "neutral",
    bestPrice: params.bestPrice,
    bestBook: params.bestBook,
    opportunityScore: 10,
    confidenceScore: 0.8,
    confidenceLabel: "Moderate Confidence",
    confidenceNotes: [],
    staleStrength: 0,
    staleSummary: "In line with market",
    sharpParticipationPct: 0.5,
    movementSummary: "Stable",
    movementQuality: "weak",
    timingSignal: { label: "Stable for now", urgencyScore: 0.1, reasons: [] },
    sharpDeviation: 0,
    explanation: "test",
    pinnedActionability: {
      bestPinnedBookKey: null,
      bestPinnedBookTitle: null,
      bestPinnedEdgePct: 0,
      bestPinnedEvPct: 0,
      pinnedStaleStrength: 0,
      pinnedScore: 0,
      actionable: false,
      globalBestBookKey: params.bestBook.toLowerCase(),
      globalBestBookTitle: params.bestBook,
      globalBestEdgePct: 2.1,
      globalPriceAvailableInPinned: false
    },
    evReliability: "full",
    books
  };
}

function makeEvent(params: {
  id: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
  contributingBookCount: number;
  outcome: FairOutcome;
}): FairEvent {
  return {
    id: params.id,
    baseEventId: params.id,
    commenceTime: params.commenceTime,
    homeTeam: params.homeTeam,
    awayTeam: params.awayTeam,
    sportKey: "basketball_nba",
    market: "h2h",
    bookCount: 2,
    contributingBookCount: params.contributingBookCount,
    totalBookCount: 2,
    maxAbsEdgePct: 2.1,
    opportunityScore: 10,
    confidenceScore: 0.8,
    confidenceLabel: "Moderate Confidence",
    staleStrength: 0,
    timingLabel: "Stable for now",
    rankingSummary: "test",
    excludedBooks: [],
    outcomes: [params.outcome]
  };
}

test("buildBoardDrilldownRows keeps only comparable events and ranks by value", () => {
  const board = {
    ok: true,
    league: "nba",
    sportKey: "basketball_nba",
    market: "h2h",
    model: "weighted",
    updatedAt: "2026-03-08T12:00:00.000Z",
    lastUpdatedLabel: "Rolling 24h window",
    activeMarkets: [],
    marketAvailability: [],
    sharpBooksUsed: [],
    books: [],
    events: [
      makeEvent({
        id: "high-value",
        commenceTime: "2099-01-02T00:00:00.000Z",
        homeTeam: "Home A",
        awayTeam: "Away A",
        contributingBookCount: 4,
        outcome: makeOutcome({
          name: "Home A",
          fairAmerican: -105,
          bestBook: "Book A",
          bestPrice: 120,
          secondBook: "Book B",
          secondPrice: -110
        })
      }),
      makeEvent({
        id: "low-value",
        commenceTime: "2099-01-01T12:00:00.000Z",
        homeTeam: "Home B",
        awayTeam: "Away B",
        contributingBookCount: 3,
        outcome: makeOutcome({
          name: "Away B",
          fairAmerican: -110,
          bestBook: "Book C",
          bestPrice: -105,
          secondBook: "Book D",
          secondPrice: -115
        })
      }),
      makeEvent({
        id: "filtered-out",
        commenceTime: "2099-01-03T00:00:00.000Z",
        homeTeam: "Home C",
        awayTeam: "Away C",
        contributingBookCount: 2,
        outcome: makeOutcome({
          name: "Home C",
          fairAmerican: -110,
          bestBook: "Book E",
          bestPrice: -102,
          secondBook: "Book F",
          secondPrice: -118
        })
      })
    ],
    topOpportunities: [],
    bookBehavior: [],
    diagnostics: {
      calibration: {
        pinned: {
          scoreWeights: {
            edge: 0,
            confidence: 0,
            stale: 0,
            urgency: 0
          },
          actionableEdgePct: 1
        },
        stale: {
          thresholds: {
            stalePriceStrength: 0,
            laggingStrength: 0,
            offMarketStrength: 0
          }
        },
        ev: {
          spreadTotals: {
            minimumConfidence: 0,
            minimumCoverage: 0,
            minimumContributingBooks: 0
          }
        }
      },
      calibrationMeta: {
        version: 1
      },
      validation: {
        emittedEvents: 0,
        sink: "memory"
      }
    },
    disclaimer: "test"
  } as unknown as FairBoardResponse;

  const rows = buildBoardDrilldownRows(board, { minBooks: 3 });

  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.id, "high-value:Home A");
  assert.equal(rows[1]?.id, "low-value:Away B");
  assert.equal(rows[0]?.bestBook, "Book A");
  assert.equal(rows[0]?.expanded.offers[0]?.book, "Book A");
  assert.equal(rows[0]?.isLive, false);
});
