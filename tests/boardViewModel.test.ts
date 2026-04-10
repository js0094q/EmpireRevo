import test from "node:test";
import assert from "node:assert/strict";
import type { FairBoardResponse, FairEvent, FairOutcome, FairOutcomeBook } from "../lib/server/odds/types";
import { buildBoardViewModel } from "../lib/ui/view-models/boardViewModel";

function makeBook(overrides: Partial<FairOutcomeBook> = {}): FairOutcomeBook {
  return {
    bookKey: "fanduel",
    title: "FanDuel",
    tier: "mainstream",
    isSharpBook: false,
    weight: 1,
    priceAmerican: 120,
    fairPriceAmerican: 108,
    marketPriceAmerican: 120,
    marketImpliedProb: 0.45,
    fairImpliedProb: 0.48,
    priceDeltaAmerican: 12,
    probabilityGapPct: 3,
    priceValueDirection: "better_than_fair",
    impliedProb: 0.45,
    impliedProbNoVig: 0.46,
    edgePct: 3,
    evPct: 2.1,
    evQualified: true,
    evReliability: "full",
    isBestPrice: true,
    lastUpdate: new Date().toISOString(),
    ...overrides
  };
}

function makeOutcome(overrides: Partial<FairOutcome> = {}): FairOutcome {
  const book = makeBook();
  return {
    name: "Away",
    fairProb: 0.48,
    fairAmerican: 108,
    consensusDirection: "underdog",
    bestPrice: book.priceAmerican,
    bestBook: book.title,
    opportunityScore: 80,
    confidenceScore: 0.78,
    confidenceLabel: "High Confidence",
    confidenceNotes: [],
    staleStrength: 0.1,
    staleSummary: "Broad support",
    sharpParticipationPct: 0.35,
    movementSummary: "Stable",
    movementQuality: "moderate",
    timingSignal: { label: "Stable for now", urgencyScore: 0.25, reasons: [] },
    sharpDeviation: 0.4,
    explanation: "test",
    pinnedActionability: {
      bestPinnedBookKey: "fanduel",
      bestPinnedBookTitle: "FanDuel",
      bestPinnedEdgePct: 3,
      bestPinnedEvPct: 2.1,
      pinnedStaleStrength: 0.1,
      pinnedScore: 68,
      actionable: true,
      globalBestBookKey: "fanduel",
      globalBestBookTitle: "FanDuel",
      globalBestEdgePct: 3,
      globalPriceAvailableInPinned: true
    },
    evReliability: "full",
    books: [book],
    ...overrides
  };
}

function makeEvent(overrides: Partial<FairEvent> = {}): FairEvent {
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
    maxAbsEdgePct: 3,
    opportunityScore: 85,
    confidenceScore: 0.8,
    confidenceLabel: "High Confidence",
    staleStrength: 0.1,
    timingLabel: "Stable for now",
    marketPressureLabel: "broad-consensus",
    rankingSummary: "test",
    excludedBooks: [],
    outcomes: [makeOutcome()],
    ...overrides
  };
}

test("buildBoardViewModel shapes actionable row with pinned book pricing", () => {
  const board = {
    ok: true,
    league: "nba",
    sportKey: "basketball_nba",
    market: "h2h",
    model: "weighted",
    updatedAt: new Date().toISOString(),
    lastUpdatedLabel: "Updated recently",
    activeMarkets: ["h2h"],
    marketAvailability: [],
    sharpBooksUsed: [],
    books: [{ key: "fanduel", title: "FanDuel", tier: "mainstream" }],
    events: [makeEvent()],
    topOpportunities: [],
    bookBehavior: [],
    diagnostics: {
      calibration: {} as FairBoardResponse["diagnostics"]["calibration"],
      calibrationMeta: { version: 1 },
      validation: { emittedEvents: 0, sink: "memory" }
    },
    disclaimer: "test"
  } as unknown as FairBoardResponse;

  const viewModel = buildBoardViewModel({
    board,
    league: "nba",
    model: "weighted",
    mode: "board",
    filters: {
      search: "",
      sort: "score",
      edgeThresholdPct: 0,
      minBooks: 4,
      pinnedOnly: false,
      includeStale: true,
      pinnedBooks: new Set(["fanduel"])
    }
  });

  assert.equal(viewModel.rows.length, 1);
  assert.equal(viewModel.rows[0]?.bestBook, "FanDuel");
  assert.equal(viewModel.rows[0]?.bestPinnedPrice, "+120");
  assert.equal(viewModel.rows[0]?.isActionable, true);
});

test("buildBoardViewModel excludes stale rows when includeStale is false", () => {
  const staleEvent = makeEvent({
    id: "stale",
    confidenceLabel: "Stale Market",
    staleStrength: 0.8
  });
  const board = {
    ok: true,
    league: "nba",
    sportKey: "basketball_nba",
    market: "h2h",
    model: "weighted",
    updatedAt: new Date().toISOString(),
    lastUpdatedLabel: "Updated recently",
    activeMarkets: ["h2h"],
    marketAvailability: [],
    sharpBooksUsed: [],
    books: [{ key: "fanduel", title: "FanDuel", tier: "mainstream" }],
    events: [staleEvent],
    topOpportunities: [],
    bookBehavior: [],
    diagnostics: {
      calibration: {} as FairBoardResponse["diagnostics"]["calibration"],
      calibrationMeta: { version: 1 },
      validation: { emittedEvents: 0, sink: "memory" }
    },
    disclaimer: "test"
  } as unknown as FairBoardResponse;

  const hidden = buildBoardViewModel({
    board,
    league: "nba",
    model: "weighted",
    mode: "board",
    filters: {
      search: "",
      sort: "score",
      edgeThresholdPct: 0,
      minBooks: 4,
      pinnedOnly: false,
      includeStale: false,
      pinnedBooks: new Set<string>()
    }
  });

  assert.equal(hidden.rows.length, 0);
});
