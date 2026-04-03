import test from "node:test";
import assert from "node:assert/strict";
import type { FairBoardResponse, FairEvent, FairOutcome, FairOutcomeBook } from "../lib/server/odds/types";
import { buildLegacyBoardGames } from "../lib/server/odds/legacyBoard";

function makeBook(params: { bookKey: string; title: string; priceAmerican: number; lastUpdate: string }): FairOutcomeBook {
  return {
    bookKey: params.bookKey,
    title: params.title,
    tier: "sharp",
    isSharpBook: true,
    weight: 1,
    priceAmerican: params.priceAmerican,
    impliedProb: 0.5,
    impliedProbNoVig: 0.5,
    edgePct: 1.2,
    evPct: 2.4,
    evQualified: true,
    isBestPrice: true,
    lastUpdate: params.lastUpdate
  };
}

function makeOutcome(params: { name: string; fairAmerican: number; priceAmerican: number; lastUpdate: string }): FairOutcome {
  const book = makeBook({
    bookKey: `${params.name.toLowerCase().replace(/[^a-z0-9]+/g, "")}-book`,
    title: "Pinnacle",
    priceAmerican: params.priceAmerican,
    lastUpdate: params.lastUpdate
  });

  return {
    name: params.name,
    fairProb: 0.5,
    fairAmerican: params.fairAmerican,
    consensusDirection: "neutral",
    bestPrice: params.priceAmerican,
    bestBook: "Pinnacle",
    opportunityScore: 10,
    confidenceScore: 0.8,
    confidenceLabel: "Moderate Confidence",
    confidenceNotes: [],
    staleStrength: 0,
    staleSummary: "In line",
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
      globalBestBookKey: book.bookKey,
      globalBestBookTitle: book.title,
      globalBestEdgePct: 1.2,
      globalPriceAvailableInPinned: false
    },
    evReliability: "full",
    books: [book]
  };
}

function makeEvent(params: {
  id: string;
  baseEventId: string;
  linePoint: number;
  commenceTime: string;
  priceAmerican: number;
  lastUpdate: string;
}): FairEvent {
  return {
    id: params.id,
    baseEventId: params.baseEventId,
    commenceTime: params.commenceTime,
    homeTeam: "Boston Celtics",
    awayTeam: "New York Knicks",
    sportKey: "basketball_nba",
    market: "spreads",
    linePoint: params.linePoint,
    bookCount: 1,
    contributingBookCount: 1,
    totalBookCount: 1,
    maxAbsEdgePct: 1.2,
    opportunityScore: 10,
    confidenceScore: 0.8,
    confidenceLabel: "Moderate Confidence",
    staleStrength: 0,
    timingLabel: "Stable for now",
    rankingSummary: "test",
    excludedBooks: [],
    outcomes: [
      makeOutcome({
        name: "Boston Celtics",
        fairAmerican: -110,
        priceAmerican: params.priceAmerican,
        lastUpdate: params.lastUpdate
      })
    ]
  };
}

test("buildLegacyBoardGames sorts representative market events by line before emitting them", () => {
  const earlier = "2026-03-08T12:00:00.000Z";
  const later = "2026-03-08T12:05:00.000Z";
  const board = {
    ok: true,
    league: "nba",
    sportKey: "basketball_nba",
    market: "spreads",
    model: "weighted",
    updatedAt: later,
    lastUpdatedLabel: "Rolling 24h window",
    activeMarkets: [],
    marketAvailability: [],
    sharpBooksUsed: [],
    books: [],
    events: [
      makeEvent({
        id: "event-late-line",
        baseEventId: "game-1",
        linePoint: -3.5,
        commenceTime: "2026-03-09T00:00:00.000Z",
        priceAmerican: -108,
        lastUpdate: later
      }),
      makeEvent({
        id: "event-early-line",
        baseEventId: "game-1",
        linePoint: -4.5,
        commenceTime: "2026-03-09T00:00:00.000Z",
        priceAmerican: -112,
        lastUpdate: earlier
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

  const games = buildLegacyBoardGames({
    boards: [board],
    league: "nba",
    fallbackUpdatedAt: earlier
  });

  assert.equal(games.length, 1);
  assert.deepEqual(
    games[0]?.markets.map((market) => market.linePoint),
    [-4.5, -3.5]
  );
});
