import test from "node:test";
import assert from "node:assert/strict";
import { summarizeBookBehavior } from "../lib/server/odds/evaluation";
import { DEFAULT_ODDS_CALIBRATION } from "../lib/server/odds/calibration";
import type { FairEvent } from "../lib/server/odds/types";

function makeEvent(): FairEvent {
  return {
    id: "evt",
    baseEventId: "evt",
    commenceTime: "2099-01-01T00:00:00.000Z",
    homeTeam: "Home",
    awayTeam: "Away",
    sportKey: "basketball_nba",
    market: "h2h",
    linePoint: undefined,
    bookCount: 2,
    contributingBookCount: 2,
    totalBookCount: 2,
    maxAbsEdgePct: 1.4,
    opportunityScore: 65,
    confidenceScore: 0.72,
    confidenceLabel: "Moderate Confidence",
    staleStrength: 0.62,
    timingLabel: "Likely closing",
    rankingSummary: "test",
    excludedBooks: [],
    outcomes: [
      {
        name: "Away",
        fairProb: 0.52,
        fairAmerican: -108,
        consensusDirection: "favored",
        bestPrice: -105,
        bestBook: "Lag",
        opportunityScore: 65,
        confidenceScore: 0.72,
        confidenceLabel: "Moderate Confidence",
        confidenceNotes: [],
        staleStrength: 0.62,
        staleSummary: "Stale price",
        sharpParticipationPct: 0.35,
        movementSummary: "Fair line moving with sharp books",
        movementQuality: "strong",
        timingSignal: { label: "Likely closing", urgencyScore: 0.8, reasons: ["test"] },
        sharpDeviation: 0.8,
        explanation: "test",
        pinnedActionability: {
          bestPinnedBookKey: null,
          bestPinnedBookTitle: null,
          bestPinnedEdgePct: 0,
          bestPinnedEvPct: 0,
          pinnedStaleStrength: 0,
          pinnedScore: 0,
          actionable: false,
          globalBestBookKey: "lag",
          globalBestBookTitle: "Lag",
          globalBestEdgePct: 1.4,
          globalPriceAvailableInPinned: false
        },
        evReliability: "full",
        books: [
          {
            bookKey: "lag",
            title: "Lag",
            tier: "mainstream",
            isSharpBook: false,
            weight: 1,
            priceAmerican: -105,
            impliedProb: 0.512,
            impliedProbNoVig: 0.5,
            edgePct: 1.4,
            evPct: 2.2,
            evQualified: true,
            evReliability: "full",
            isBestPrice: true,
            staleStrength: 0.72,
            staleFlag: "lagging_book",
            staleActionable: true,
            consensusGapPct: 2.5,
            movement: {
              openPrice: -110,
              prevPrice: -106,
              currentPrice: -105,
              delta: 5,
              move: 5,
              updatedAt: "2099-01-01T00:00:00.000Z",
              history: []
            }
          },
          {
            bookKey: "sharp",
            title: "Sharp",
            tier: "sharp",
            isSharpBook: true,
            weight: 1,
            priceAmerican: -110,
            impliedProb: 0.523,
            impliedProbNoVig: 0.503,
            edgePct: 0.8,
            evPct: 1.1,
            evQualified: true,
            evReliability: "full",
            isBestPrice: false,
            staleStrength: 0.3,
            staleFlag: "none",
            staleActionable: false,
            consensusGapPct: 0.2,
            movement: {
              openPrice: -110,
              prevPrice: -111,
              currentPrice: -110,
              delta: 0,
              move: 4,
              updatedAt: "2099-01-01T00:00:00.000Z",
              history: []
            }
          }
        ]
      }
    ]
  };
}

test("book responsiveness summary includes lag and move-first indicators", () => {
  const summary = summarizeBookBehavior([makeEvent()], DEFAULT_ODDS_CALIBRATION);
  const lag = summary.find((entry) => entry.bookKey === "lag");
  assert.ok(lag);
  assert.ok((lag?.lagRate || 0) > 0);
  assert.ok((lag?.moveFirstRate || 0) > 0);
});
