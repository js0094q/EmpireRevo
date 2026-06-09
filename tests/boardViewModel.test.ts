import test from "node:test";
import assert from "node:assert/strict";
import type { FairBoardResponse, FairEvent, FairOutcome, FairOutcomeBook, PersistedOutcomeResult } from "../lib/server/odds/types";
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
      bookKey: "all",
      edgeThresholdPct: 0,
      confidence: "all",
      outcomeStatus: "all",
      minBooks: 4,
      pinnedOnly: false,
      includeStale: true,
      pinnedBooks: new Set(["fanduel"])
    }
  });

  assert.equal(viewModel.rows.length, 1);
  assert.equal(viewModel.resultLabel, "1 market");
  assert.equal(viewModel.coverageLabel, "1 book");
  assert.equal(viewModel.rows[0]?.bestBook, "FanDuel");
  assert.equal(viewModel.rows[0]?.bestBookAbbrev, "FAND");
  assert.equal(viewModel.rows[0]?.bestPinnedPrice, "+120");
  assert.equal(viewModel.rows[0]?.pinnedAvailability, "Pinned available");
  assert.equal(viewModel.rows[0]?.priceSignal, "Above consensus");
  assert.equal(viewModel.rows[0]?.probabilityGap, "+3.00pp");
  assert.equal(viewModel.rows[0]?.ev, "+2.10%");
  assert.equal(viewModel.rows[0]?.evMeta, "Strong opportunity");
  assert.equal(viewModel.rows[0]?.evTone, "positive");
  assert.equal(viewModel.rows[0]?.coverage, "4 books");
  assert.equal(viewModel.rows[0]?.isActionable, true);
  assert.equal(viewModel.rows[0]?.outcomeLabel, "Pending");
  assert.ok(viewModel.statusItems.some((item) => item.label === "Stale excluded"));
  assert.ok(viewModel.rows[0]?.whySignal.some((item) => item.label === "Consensus fair" && item.value === "+108"));

  const filteredByBestBook = buildBoardViewModel({
    board,
    league: "nba",
    model: "weighted",
    mode: "board",
    filters: {
      search: "",
      sort: "score",
      bookKey: "fanduel",
      edgeThresholdPct: 0,
      confidence: "all",
      outcomeStatus: "all",
      minBooks: 4,
      pinnedOnly: false,
      includeStale: true,
      pinnedBooks: new Set(["fanduel"])
    }
  });

  assert.equal(filteredByBestBook.rows.length, 1);
});

test("buildBoardViewModel attaches and filters persisted outcome status", () => {
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
  const outcomes: PersistedOutcomeResult[] = [
    {
      version: 1,
      id: "basketball_nba:evt-1:h2h:away:away",
      createdAt: 1,
      updatedAt: 1,
      sportKey: "basketball_nba",
      eventId: "evt-1",
      marketKey: "h2h:away",
      sideKey: "away",
      result: "win",
      source: "manual"
    }
  ];

  const viewModel = buildBoardViewModel({
    board,
    league: "nba",
    model: "weighted",
    mode: "board",
    outcomes,
    filters: {
      search: "",
      sort: "outcome",
      bookKey: "all",
      edgeThresholdPct: 0,
      confidence: "all",
      outcomeStatus: "win",
      minBooks: 4,
      pinnedOnly: false,
      includeStale: true,
      pinnedBooks: new Set<string>()
    }
  });

  assert.equal(viewModel.rows.length, 1);
  assert.equal(viewModel.rows[0]?.outcomeLabel, "Win");
  assert.equal(viewModel.rows[0]?.outcomeTone, "positive");
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
      bookKey: "all",
      edgeThresholdPct: 0,
      confidence: "all",
      outcomeStatus: "all",
      minBooks: 4,
      pinnedOnly: false,
      includeStale: false,
      pinnedBooks: new Set<string>()
    }
  });

  assert.equal(hidden.rows.length, 0);
  assert.equal(hidden.staleExcludedCount, 1);
});

test("buildBoardViewModel treats old feed-published events as historical unless stale is included", () => {
  const historicalEvent = makeEvent({
    id: "historical",
    commenceTime: new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString()
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
    events: [historicalEvent],
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
      bookKey: "all",
      edgeThresholdPct: 0,
      confidence: "all",
      outcomeStatus: "all",
      minBooks: 4,
      pinnedOnly: false,
      includeStale: false,
      pinnedBooks: new Set<string>()
    }
  });
  const visible = buildBoardViewModel({
    board,
    league: "nba",
    model: "weighted",
    mode: "board",
    filters: {
      search: "",
      sort: "score",
      bookKey: "all",
      edgeThresholdPct: 0,
      confidence: "all",
      outcomeStatus: "all",
      minBooks: 4,
      pinnedOnly: false,
      includeStale: true,
      pinnedBooks: new Set<string>()
    }
  });

  assert.equal(hidden.rows.length, 0);
  assert.equal(hidden.staleExcludedCount, 1);
  assert.equal(visible.rows[0]?.marketStatus, "Historical");
  assert.equal(visible.rows[0]?.staleLabel, "Historical");
});

test("buildBoardViewModel keeps below-market EV states neutral", () => {
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
    events: [makeEvent({
      id: "evt-2",
      outcomes: [makeOutcome({
        books: [
          makeBook({
            priceAmerican: 100,
            marketPriceAmerican: 100,
            fairPriceAmerican: 108,
            marketImpliedProb: 0.5,
            fairImpliedProb: 0.45,
            evPct: -1.2,
            evQualified: true,
            priceValueDirection: "worse_than_fair"
          })
        ]
      })]
    })],
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
      bookKey: "all",
      edgeThresholdPct: 0,
      confidence: "all",
      outcomeStatus: "all",
      minBooks: 4,
      pinnedOnly: false,
      includeStale: true,
      pinnedBooks: new Set<string>()
    }
  });

  assert.equal(viewModel.rows.length, 1);
  assert.equal(viewModel.rows[0]?.evTone, "neutral");
  assert.equal(viewModel.rows[0]?.evMeta, "Market is less favorable");
  assert.equal(viewModel.rows[0]?.priceSignal, "Below market");
});
