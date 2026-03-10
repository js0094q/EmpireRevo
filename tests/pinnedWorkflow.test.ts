import test from "node:test";
import assert from "node:assert/strict";
import type { FairEvent } from "../lib/server/odds/types";
import { filterEvents, pinnedEventMetrics, sortEvents } from "../components/board/selectors";

function event(id: string, pinnedEdge: number, globalEdge: number): FairEvent {
  return {
    id,
    commenceTime: "2099-01-01T00:00:00.000Z",
    homeTeam: "Home",
    awayTeam: "Away",
    sportKey: "basketball_nba",
    market: "h2h",
    bookCount: 2,
    contributingBookCount: 2,
    totalBookCount: 2,
    maxAbsEdgePct: Math.max(pinnedEdge, globalEdge),
    opportunityScore: globalEdge * 20,
    confidenceScore: 0.7,
    confidenceLabel: "Moderate Confidence",
    staleStrength: 0.4,
    timingLabel: "Stable for now",
    rankingSummary: "test",
    excludedBooks: [],
    outcomes: [
      {
        name: "Away",
        fairProb: 0.52,
        fairAmerican: -108,
        consensusDirection: "favored",
        bestPrice: -102,
        bestBook: "Global",
        opportunityScore: globalEdge * 20,
        confidenceScore: 0.7,
        confidenceLabel: "Moderate Confidence",
        confidenceNotes: [],
        staleStrength: 0.4,
        staleSummary: "In line with market",
        sharpParticipationPct: 0.3,
        movementSummary: "Movement mixed across books",
        movementQuality: "moderate",
        timingSignal: { label: "Stable for now", urgencyScore: 0.4, reasons: ["test"] },
        sharpDeviation: 0.3,
        explanation: "test",
        pinnedActionability: {
          bestPinnedBookKey: null,
          bestPinnedBookTitle: null,
          bestPinnedEdgePct: 0,
          bestPinnedEvPct: 0,
          pinnedStaleStrength: 0,
          pinnedScore: 0,
          actionable: false,
          globalBestBookKey: "global",
          globalBestBookTitle: "Global",
          globalBestEdgePct: globalEdge,
          globalPriceAvailableInPinned: false
        },
        evReliability: "full",
        books: [
          {
            bookKey: "global",
            title: "Global",
            tier: "mainstream",
            isSharpBook: false,
            weight: 1,
            priceAmerican: -102,
            impliedProb: 0.51,
            impliedProbNoVig: 0.5,
            edgePct: globalEdge,
            evPct: 2,
            evQualified: true,
            evReliability: "full",
            isBestPrice: true,
            staleStrength: 0.3,
            staleActionable: false
          },
          {
            bookKey: "pinned",
            title: "Pinned",
            tier: "mainstream",
            isSharpBook: false,
            weight: 1,
            priceAmerican: -105,
            impliedProb: 0.52,
            impliedProbNoVig: 0.51,
            edgePct: pinnedEdge,
            evPct: 1.1,
            evQualified: true,
            evReliability: "full",
            isBestPrice: false,
            staleStrength: 0.65,
            staleActionable: true,
            staleFlag: "stale_price"
          }
        ]
      }
    ]
  };
}

test("pinned metrics distinguish global best from user-actionable pinned line", () => {
  const sample = event("a", 1.1, 1.7);
  const metrics = pinnedEventMetrics(sample, new Set(["pinned"]), 0.5);

  assert.equal(metrics.hasActionable, true);
  assert.equal(metrics.bestEdge, 1.1);
});

test("sort by pinned score prioritizes actionable pinned opportunities", () => {
  const a = event("a", 1.2, 1.8);
  const b = event("b", 0.3, 2.2);

  const sorted = sortEvents([a, b], "pinned_score", {
    pinnedBooks: new Set(["pinned"]),
    pinnedActionableEdgeThreshold: 0.5
  });

  assert.equal(sorted[0]?.id, "a");
});

test("pinned-only filter keeps only events bettable at pinned books", () => {
  const keep = event("keep", 0.9, 1.8);
  const drop = event("drop", 0.2, 2.2);

  const filtered = filterEvents([keep, drop], {
    teamQuery: "",
    visibleBookKeys: new Set(["global", "pinned"]),
    edgeThresholdPct: 0,
    minContributingBooks: 1,
    minConfidenceScore: 0,
    minSharpParticipation: 0,
    startWindow: "all",
    positiveEvOnly: false,
    sideFilter: "all",
    bestEdgesOnly: false,
    staleOnly: false,
    highCoverageOnly: false,
    trustedBooksOnly: false,
    pinnedOnly: true,
    pinnedBooks: new Set(["pinned"]),
    pinnedActionableEdgeThreshold: 0.5
  });

  assert.deepEqual(filtered.map((item) => item.id), ["keep"]);
});
