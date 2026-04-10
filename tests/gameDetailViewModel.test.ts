import test from "node:test";
import assert from "node:assert/strict";
import type { GameDetailPageData } from "../lib/server/odds/gameDetailPageData";
import type { FairEvent, FairOutcome, FairOutcomeBook } from "../lib/server/odds/types";
import { buildGameDetailViewModel } from "../lib/ui/view-models/gameDetailViewModel";

function makeBook(overrides: Partial<FairOutcomeBook> = {}): FairOutcomeBook {
  return {
    bookKey: "pinnacle",
    title: "Pinnacle",
    tier: "sharp",
    isSharpBook: true,
    weight: 1,
    priceAmerican: -108,
    impliedProb: 0.52,
    impliedProbNoVig: 0.51,
    edgePct: 1.2,
    evPct: 0.8,
    evQualified: true,
    isBestPrice: true,
    lastUpdate: new Date().toISOString(),
    ...overrides
  };
}

function makeOutcome(overrides: Partial<FairOutcome> = {}): FairOutcome {
  return {
    name: "Away",
    fairProb: 0.5,
    fairAmerican: 100,
    consensusDirection: "underdog",
    bestPrice: -108,
    bestBook: "Pinnacle",
    opportunityScore: 75,
    confidenceScore: 0.72,
    confidenceLabel: "Moderate Confidence",
    confidenceNotes: ["Broad agreement"],
    staleStrength: 0.15,
    staleSummary: "No stale flags",
    sharpParticipationPct: 0.5,
    movementSummary: "Stable",
    movementQuality: "moderate",
    timingSignal: { label: "Stable for now", urgencyScore: 0.2, reasons: [] },
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
      globalBestBookKey: "pinnacle",
      globalBestBookTitle: "Pinnacle",
      globalBestEdgePct: 1.2,
      globalPriceAvailableInPinned: false
    },
    evReliability: "full",
    books: [makeBook()],
    ...overrides
  };
}

function makeEvent(): FairEvent {
  return {
    id: "evt-1",
    baseEventId: "evt-1",
    commenceTime: "2099-01-01T00:00:00.000Z",
    homeTeam: "Home",
    awayTeam: "Away",
    sportKey: "basketball_nba",
    market: "h2h",
    bookCount: 4,
    contributingBookCount: 4,
    totalBookCount: 4,
    maxAbsEdgePct: 1.2,
    opportunityScore: 75,
    confidenceScore: 0.72,
    confidenceLabel: "Moderate Confidence",
    staleStrength: 0.15,
    timingLabel: "Stable for now",
    rankingSummary: "test",
    excludedBooks: [],
    outcomes: [makeOutcome()]
  };
}

test("buildGameDetailViewModel separates internal notes from public notes", () => {
  const data = {
    league: "nba",
    model: "weighted",
    event: makeEvent(),
    featuredOutcome: makeOutcome(),
    featuredBook: makeBook(),
    featuredBooks: [makeBook()],
    marketSwitchOptions: [{ market: "h2h", href: "/game/test", status: "active", pointGroups: 1 }],
    currentMarketStatus: "active",
    showRepresentativeNote: false,
    focusCopy: "Focus copy",
    methodologyCopy: "Methodology copy",
    probabilityGapPct: 1.2,
    timeline: null,
    pressureSignals: [],
    valueTiming: {
      firstPositiveEvAt: null,
      lastPositiveEvAt: null,
      positiveEvDurationSeconds: null,
      valuePersistence: "unknown",
      edgeTrend: "flat"
    },
    latestHistoryTs: "—",
    backToBoardHref: "/",
    boardContext: { mode: "board", windowKey: "all", sortBy: "score", side: "all", search: "", positiveEdgeOnly: false },
    routeId: "evt-1",
    internalContext: {
      historyEventId: "evt-1",
      historyMarketKey: "h2h:away",
      timelinePoints: 0,
      pressureLabel: "none",
      valuePersistence: "unknown"
    }
  } as GameDetailPageData;

  const publicView = buildGameDetailViewModel(data, { includeInternal: false });
  const internalView = buildGameDetailViewModel(data, { includeInternal: true });

  assert.equal(publicView.internalNotes, null);
  assert.ok(internalView.internalNotes?.some((note) => note.label === "History Event"));
  assert.equal(publicView.comparisonRows[0]?.book, "Pinnacle");
});
