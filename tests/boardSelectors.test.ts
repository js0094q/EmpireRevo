import test from "node:test";
import assert from "node:assert/strict";
import type { FairEvent } from "../lib/server/odds/types";
import { filterEvents, orderBooksForGrid, sortEvents } from "../components/board/selectors";

function mockEvent(id: string, opts?: { edge?: number; ev?: number; commenceTime?: string; contributingBookCount?: number }): FairEvent {
  const edge = opts?.edge ?? 1.5;
  const ev = opts?.ev ?? 2.1;
  return {
    id,
    baseEventId: id,
    commenceTime: opts?.commenceTime ?? "2099-01-01T00:00:00.000Z",
    homeTeam: "Home",
    awayTeam: "Away",
    sportKey: "basketball_nba",
    market: "h2h",
    bookCount: 2,
    contributingBookCount: opts?.contributingBookCount ?? 2,
    totalBookCount: 2,
    maxAbsEdgePct: edge,
    opportunityScore: edge * 20,
    confidenceScore: 0.72,
    confidenceLabel: "Moderate Confidence",
    staleStrength: 0.25,
    timingLabel: "Stable for now",
    rankingSummary: "test summary",
    excludedBooks: [],
    outcomes: [
      {
        name: "Away",
        fairProb: 0.52,
        fairAmerican: -108,
        consensusDirection: "favored",
        bestPrice: -105,
        bestBook: "BookA",
        opportunityScore: edge * 20,
        confidenceScore: 0.72,
        confidenceLabel: "Moderate Confidence",
        confidenceNotes: [],
        staleStrength: 0.2,
        staleSummary: "In line with market",
        sharpParticipationPct: 0.2,
        movementSummary: "Movement mixed across books",
        movementQuality: "weak",
        timingSignal: { label: "Stable for now", urgencyScore: 0.34, reasons: ["test"] },
        sharpDeviation: 0.3,
        explanation: "test explanation",
        pinnedActionability: {
          bestPinnedBookKey: null,
          bestPinnedBookTitle: null,
          bestPinnedEdgePct: 0,
          bestPinnedEvPct: 0,
          pinnedStaleStrength: 0,
          pinnedScore: 0,
          actionable: false,
          globalBestBookKey: "booka",
          globalBestBookTitle: "BookA",
          globalBestEdgePct: edge,
          globalPriceAvailableInPinned: false
        },
        evReliability: "full",
        books: [
          {
            bookKey: "booka",
            title: "BookA",
            tier: "mainstream",
            isSharpBook: false,
            weight: 1,
            priceAmerican: -105,
            impliedProb: 0.5122,
            impliedProbNoVig: 0.503,
            edgePct: edge,
            evPct: ev,
            evQualified: true,
            isBestPrice: true
          }
        ]
      },
      {
        name: "Home",
        fairProb: 0.48,
        fairAmerican: 108,
        consensusDirection: "underdog",
        bestPrice: -115,
        bestBook: "BookA",
        opportunityScore: edge * 10,
        confidenceScore: 0.65,
        confidenceLabel: "Moderate Confidence",
        confidenceNotes: [],
        staleStrength: 0.15,
        staleSummary: "In line with market",
        sharpParticipationPct: 0.2,
        movementSummary: "Movement mixed across books",
        movementQuality: "weak",
        timingSignal: { label: "Weak timing signal", urgencyScore: 0.24, reasons: ["test"] },
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
          globalBestBookKey: "booka",
          globalBestBookTitle: "BookA",
          globalBestEdgePct: 0,
          globalPriceAvailableInPinned: false
        },
        evReliability: "full",
        books: [
          {
            bookKey: "booka",
            title: "BookA",
            tier: "mainstream",
            isSharpBook: false,
            weight: 1,
            priceAmerican: -115,
            impliedProb: 0.5348,
            impliedProbNoVig: 0.497,
            edgePct: -edge,
            evPct: -1.2,
            evQualified: true,
            isBestPrice: true
          }
        ]
      }
    ]
  };
}

test("filterEvents applies edge and minimum-book thresholds", () => {
  const keep = mockEvent("a", { edge: 1.2, contributingBookCount: 4 });
  const dropEdge = mockEvent("b", { edge: 0.2, contributingBookCount: 4 });
  const dropBooks = mockEvent("c", { edge: 1.5, contributingBookCount: 2 });
  const filtered = filterEvents([keep, dropEdge, dropBooks], {
    teamQuery: "",
    visibleBookKeys: new Set(["booka"]),
    edgeThresholdPct: 1,
    minContributingBooks: 3,
    minConfidenceScore: 0,
    minSharpParticipation: 0,
    startWindow: "all",
    positiveEdgeOnly: false,
    sideFilter: "all",
    bestEdgesOnly: false,
    staleOnly: false,
    highCoverageOnly: false,
    trustedBooksOnly: false,
    pinnedOnly: false,
    pinnedBooks: new Set()
  });
  assert.deepEqual(filtered.map((event) => event.id), ["a"]);
});

test("sortEvents sorts by opportunity score", () => {
  const a = mockEvent("a", { edge: 0.8 });
  const b = mockEvent("b", { edge: 1.7 });
  const sorted = sortEvents([a, b], "score");
  assert.deepEqual(sorted.map((event) => event.id), ["b", "a"]);
});

test("orderBooksForGrid keeps pinned books first", () => {
  const ordered = orderBooksForGrid(
    [
      { key: "fanduel", title: "FanDuel", tier: "mainstream" },
      { key: "draftkings", title: "DraftKings", tier: "mainstream" },
      { key: "pinnacle", title: "Pinnacle", tier: "sharp" }
    ],
    new Set(["pinnacle"])
  );
  assert.equal(ordered[0]?.key, "pinnacle");
});

test("filterEvents can require stale opportunities and pinned-book actionability", () => {
  const stalePinned = mockEvent("stale");
  stalePinned.outcomes[0].books[0].staleActionable = true;
  stalePinned.outcomes[0].books[0].staleFlag = "stale_price";
  stalePinned.outcomes[0].books[0].bookKey = "fanduel";
  stalePinned.outcomes[0].books[0].edgePct = 1.1;

  const fresh = mockEvent("fresh");
  fresh.outcomes[0].books[0].bookKey = "draftkings";
  fresh.outcomes[0].books[0].staleActionable = false;

  const filtered = filterEvents([stalePinned, fresh], {
    teamQuery: "",
    visibleBookKeys: new Set(["fanduel", "draftkings"]),
    edgeThresholdPct: 0,
    minContributingBooks: 1,
    minConfidenceScore: 0,
    minSharpParticipation: 0,
    startWindow: "all",
    positiveEdgeOnly: false,
    sideFilter: "all",
    bestEdgesOnly: false,
    staleOnly: true,
    highCoverageOnly: false,
    trustedBooksOnly: false,
    pinnedOnly: true,
    pinnedBooks: new Set(["fanduel"])
  });
  assert.deepEqual(filtered.map((event) => event.id), ["stale"]);
});

test("filterEvents side filter matches the displayed recommended pick side", () => {
  const favoritePick = mockEvent("favorite-pick", { edge: 1.2 });
  const underdogPick = mockEvent("underdog-pick", { edge: 1.2 });
  underdogPick.outcomes[0].books[0].edgePct = -0.4;
  underdogPick.outcomes[0].books[0].evPct = -0.2;
  underdogPick.outcomes[1].books[0].edgePct = 1.1;
  underdogPick.outcomes[1].books[0].evPct = 0.8;
  underdogPick.outcomes[1].opportunityScore = underdogPick.outcomes[0].opportunityScore + 10;

  const baseOptions = {
    teamQuery: "",
    visibleBookKeys: new Set(["booka"]),
    edgeThresholdPct: 0,
    minContributingBooks: 1,
    minConfidenceScore: 0,
    minSharpParticipation: 0,
    startWindow: "all" as const,
    positiveEdgeOnly: false,
    bestEdgesOnly: false,
    staleOnly: false,
    highCoverageOnly: false,
    trustedBooksOnly: false,
    pinnedOnly: false,
    pinnedBooks: new Set<string>()
  };

  const favoredOnly = filterEvents([favoritePick, underdogPick], {
    ...baseOptions,
    sideFilter: "favored"
  });
  const underdogsOnly = filterEvents([favoritePick, underdogPick], {
    ...baseOptions,
    sideFilter: "underdogs"
  });

  assert.deepEqual(favoredOnly.map((event) => event.id), ["favorite-pick"]);
  assert.deepEqual(underdogsOnly.map((event) => event.id), ["underdog-pick"]);
});

test("filterEvents positive-edge filter follows the displayed pick edge instead of EV", () => {
  const edgeOnly = mockEvent("edge-only", { edge: 1.1, ev: -0.4 });
  const evOnly = mockEvent("ev-only", { edge: -0.2, ev: 1.6 });
  evOnly.outcomes[0].books[0].edgePct = -0.2;
  evOnly.outcomes[0].books[0].evPct = 1.6;
  evOnly.outcomes[1].books[0].edgePct = -0.6;
  evOnly.outcomes[1].books[0].evPct = -0.3;

  const filtered = filterEvents([edgeOnly, evOnly], {
    teamQuery: "",
    visibleBookKeys: new Set(["booka"]),
    edgeThresholdPct: 0,
    minContributingBooks: 1,
    minConfidenceScore: 0,
    minSharpParticipation: 0,
    startWindow: "all",
    positiveEdgeOnly: true,
    sideFilter: "all",
    bestEdgesOnly: false,
    staleOnly: false,
    highCoverageOnly: false,
    trustedBooksOnly: false,
    pinnedOnly: false,
    pinnedBooks: new Set<string>()
  });

  assert.deepEqual(filtered.map((event) => event.id), ["edge-only"]);
});

test("filterEvents keeps started games visible until the feed stops publishing them", () => {
  const longRunning = mockEvent("long-running", { commenceTime: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() });
  const past = mockEvent("past", { commenceTime: new Date(Date.now() - 5 * 60 * 1000).toISOString() });
  const soon = mockEvent("soon", { commenceTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() });
  const later = mockEvent("later", { commenceTime: new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString() });

  const filtered = filterEvents([longRunning, past, soon, later], {
    teamQuery: "",
    visibleBookKeys: new Set(["booka"]),
    edgeThresholdPct: 0,
    minContributingBooks: 1,
    minConfidenceScore: 0,
    minSharpParticipation: 0,
    startWindow: "24h",
    positiveEdgeOnly: false,
    sideFilter: "all",
    bestEdgesOnly: false,
    staleOnly: false,
    highCoverageOnly: false,
    trustedBooksOnly: false,
    pinnedOnly: false,
    pinnedBooks: new Set<string>()
  });

  assert.deepEqual(filtered.map((event) => event.id), ["long-running", "past", "soon"]);
});
