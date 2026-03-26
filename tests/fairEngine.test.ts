import test from "node:test";
import assert from "node:assert/strict";
import type { NormalizedEventOdds } from "../lib/odds/schemas";
import {
  buildFairBoard,
  buildFairEventsForNormalizedEvent,
  getActiveMarketsForBoard,
  getMarketAvailabilityForBoard
} from "../lib/server/odds/fairEngine";
import { americanToDecimal } from "../lib/server/odds/fairMath";

function buildEvent(): NormalizedEventOdds {
  return {
    event: {
      id: "nba_celtics_at_knicks_2026-03-09",
      league: "nba",
      commenceTime: "2026-03-09T00:00:00.000Z",
      home: { id: "knicks", name: "New York Knicks" },
      away: { id: "celtics", name: "Boston Celtics" },
      status: "upcoming"
    },
    fetchedAt: "2026-03-08T12:00:00.000Z",
    books: [
      {
        book: { key: "pinnacle", title: "Pinnacle", tier: "sharp", weight: 1, isSharpWeighted: true },
        markets: [
          {
            market: "h2h",
            lastUpdate: "2026-03-08T12:00:00.000Z",
            outcomes: [
              { name: "Boston Celtics", price: -125 },
              { name: "New York Knicks", price: 112 }
            ]
          },
          {
            market: "spreads",
            lastUpdate: "2026-03-08T12:00:00.000Z",
            outcomes: [
              { name: "Boston Celtics", price: -110, point: -3.5 },
              { name: "New York Knicks", price: -110, point: 3.5 }
            ]
          }
        ]
      },
      {
        book: { key: "draftkings", title: "DraftKings", tier: "mainstream", weight: 0.4, isSharpWeighted: false },
        markets: [
          {
            market: "h2h",
            lastUpdate: "2026-03-08T12:05:00.000Z",
            outcomes: [
              { name: "Boston Celtics", price: -115 },
              { name: "New York Knicks", price: 105 }
            ]
          },
          {
            market: "spreads",
            lastUpdate: "2026-03-08T12:05:00.000Z",
            outcomes: [
              { name: "Boston Celtics", price: -112, point: -3.5 },
              { name: "New York Knicks", price: -108, point: 3.5 }
            ]
          }
        ]
      },
      {
        book: { key: "bovada", title: "Bovada", tier: "promo", weight: 0.18, isSharpWeighted: false },
        markets: [
          {
            market: "spreads",
            lastUpdate: "2026-03-08T12:10:00.000Z",
            outcomes: [
              { name: "Boston Celtics", price: -105, point: -4 },
              { name: "New York Knicks", price: -115, point: 4 }
            ]
          }
        ]
      }
    ]
  };
}

test("buildFairBoard produces a weighted fair moneyline", async () => {
  const event = buildEvent();
  const board = await buildFairBoard({
    normalized: [event],
    league: "nba",
    sportKey: "basketball_nba",
    market: "h2h",
    model: "weighted",
    minBooks: 2,
    timeWindowHours: 24
  });

  assert.equal(board.ok, true);
  assert.equal(board.events.length, 1);
  const firstOutcome = board.events[0].outcomes[0];
  assert.ok(firstOutcome.opportunityScore > 0);
  assert.ok(typeof firstOutcome.confidenceScore === "number");
  assert.ok(typeof firstOutcome.explanation === "string");
  assert(firstOutcome.fairAmerican < 0, "favorite should have negative fair price");
  assert.ok(firstOutcome.books.some((book) => book.isBestPrice));
  assert.ok(board.events[0].maxAbsEdgePct > 0);
  assert.ok(board.topOpportunities.length > 0);
  assert.ok(Math.abs(board.topOpportunities[0]?.edgePct ?? 0) >= Math.abs(board.topOpportunities[1]?.edgePct ?? 0));

  const sampleBook = firstOutcome.books[0]!;
  const expectedEdge = (firstOutcome.fairProb - sampleBook.impliedProbNoVig) * 100;
  const expectedEv = (firstOutcome.fairProb * americanToDecimal(sampleBook.priceAmerican) - 1) * 100;
  assert.ok(Math.abs(sampleBook.edgePct - expectedEdge) < 1e-6);
  assert.ok(Math.abs(sampleBook.evPct - expectedEv) < 1e-6);
  assert.notEqual(sampleBook.edgePct.toFixed(4), sampleBook.evPct.toFixed(4));
});

test("buildFairBoard aligns outcomes by name when books publish reversed order", async () => {
  const event = buildEvent();
  const draftKings = event.books.find((book) => book.book.key === "draftkings");
  assert.ok(draftKings);
  const draftKingsH2h = draftKings.markets.find((market) => market.market === "h2h");
  assert.ok(draftKingsH2h);
  draftKingsH2h.outcomes = [draftKingsH2h.outcomes[1]!, draftKingsH2h.outcomes[0]!];

  const board = await buildFairBoard({
    normalized: [event],
    league: "nba",
    sportKey: "basketball_nba",
    market: "h2h",
    model: "weighted",
    minBooks: 2,
    timeWindowHours: 24
  });

  const firstEvent = board.events[0];
  assert.ok(firstEvent);
  const celticsOutcome = firstEvent.outcomes.find((outcome) => outcome.name === "Boston Celtics");
  assert.ok(celticsOutcome);
  const draftKingsBook = celticsOutcome.books.find((book) => book.bookKey === "draftkings");
  assert.equal(draftKingsBook?.priceAmerican, -115);
});

test("buildFairBoard aligns outcomes across team-label aliases", async () => {
  const event = buildEvent();
  const draftKings = event.books.find((book) => book.book.key === "draftkings");
  assert.ok(draftKings);
  const draftKingsH2h = draftKings.markets.find((market) => market.market === "h2h");
  assert.ok(draftKingsH2h);
  draftKingsH2h.outcomes = [
    { name: "Celtics", price: -115 },
    { name: "NY Knicks", price: 105 }
  ];

  const board = await buildFairBoard({
    normalized: [event],
    league: "nba",
    sportKey: "basketball_nba",
    market: "h2h",
    model: "weighted",
    minBooks: 2,
    timeWindowHours: 24
  });

  const firstEvent = board.events[0];
  assert.ok(firstEvent);
  const knicksOutcome = firstEvent.outcomes.find((outcome) => outcome.name === "New York Knicks");
  assert.ok(knicksOutcome);
  const draftKingsBook = knicksOutcome.books.find((book) => book.bookKey === "draftkings");
  assert.equal(draftKingsBook?.priceAmerican, 105);
});

test("buildFairBoard aligns totals outcomes when labels include point text", async () => {
  const event = buildEvent();
  event.books = [
    {
      book: { key: "pinnacle", title: "Pinnacle", tier: "sharp", weight: 1, isSharpWeighted: true },
      markets: [
        {
          market: "totals",
          lastUpdate: "2026-03-08T12:00:00.000Z",
          outcomes: [
            { name: "Over 228.5", price: -110, point: 228.5 },
            { name: "Under 228.5", price: -110, point: 228.5 }
          ]
        }
      ]
    },
    {
      book: { key: "draftkings", title: "DraftKings", tier: "mainstream", weight: 0.4, isSharpWeighted: false },
      markets: [
        {
          market: "totals",
          lastUpdate: "2026-03-08T12:05:00.000Z",
          outcomes: [
            { name: "Over", price: -112, point: 228.5 },
            { name: "Under", price: -108, point: 228.5 }
          ]
        }
      ]
    }
  ];

  const board = await buildFairBoard({
    normalized: [event],
    league: "nba",
    sportKey: "basketball_nba",
    market: "totals",
    model: "weighted",
    minBooks: 2,
    timeWindowHours: 24
  });

  const firstEvent = board.events[0];
  assert.ok(firstEvent);
  assert.equal(firstEvent.outcomes.length, 2);
  const overOutcome = firstEvent.outcomes.find((outcome) => outcome.name.toLowerCase().startsWith("over"));
  assert.ok(overOutcome);
  const draftKingsBook = overOutcome.books.find((book) => book.bookKey === "draftkings");
  assert.equal(draftKingsBook?.priceAmerican, -112);
});

test("buildFairBoard keeps spread markets point-aware", async () => {
  const event = buildEvent();
  const board = await buildFairBoard({
    normalized: [event],
    league: "nba",
    sportKey: "basketball_nba",
    market: "spreads",
    model: "weighted",
    minBooks: 2,
    timeWindowHours: 24
  });

  assert.equal(board.events.length, 1);
  const spreadEvent = board.events[0];
  assert.equal(spreadEvent.linePoint, -3.5);
  assert.equal(spreadEvent.outcomes[0].books.length, 2);
  assert.equal(spreadEvent.bookCount, 2);
  assert.equal(spreadEvent.totalBookCount, 3);
  assert.ok(spreadEvent.excludedBooks.some((book) => book.bookKey === "bovada"));
});

test("buildFairBoard spread best-price picks better point before payout", async () => {
  const event = buildEvent();
  event.books.push({
    book: { key: "fanduel", title: "FanDuel", tier: "mainstream", weight: 0.38, isSharpWeighted: false },
    markets: [
      {
        market: "spreads",
        lastUpdate: "2026-03-08T12:15:00.000Z",
        outcomes: [
          { name: "Boston Celtics", price: -115, point: -3 },
          { name: "New York Knicks", price: 100, point: 3 }
        ]
      }
    ]
  });
  event.books.push({
    book: { key: "caesars", title: "Caesars", tier: "mainstream", weight: 0.34, isSharpWeighted: false },
    markets: [
      {
        market: "spreads",
        lastUpdate: "2026-03-08T12:16:00.000Z",
        outcomes: [
          { name: "Boston Celtics", price: -118, point: -3 },
          { name: "New York Knicks", price: 102, point: 3 }
        ]
      }
    ]
  });

  const board = await buildFairBoard({
    normalized: [event],
    league: "nba",
    sportKey: "basketball_nba",
    market: "spreads",
    model: "weighted",
    minBooks: 2,
    timeWindowHours: 24
  });

  assert.equal(board.events.length, 2);
  const matched = board.events.find((row) => row.linePoint === -3);
  assert.ok(matched);
  const best = matched?.outcomes[0]?.books.find((book) => book.isBestPrice);
  assert.equal(best?.bookKey, "fanduel");
});

test("getActiveMarketsForBoard only returns markets with usable live lines", () => {
  const activeMarkets = getActiveMarketsForBoard({
    normalized: [buildEvent()],
    model: "weighted",
    minBooks: 2
  });

  assert.deepEqual(activeMarkets, ["h2h", "spreads"]);
});

test("getMarketAvailabilityForBoard distinguishes active, limited, and unavailable markets", () => {
  const event = buildEvent();
  event.books.push({
    book: { key: "fanduel", title: "FanDuel", tier: "mainstream", weight: 0.38, isSharpWeighted: false },
    markets: [
      {
        market: "h2h",
        lastUpdate: "2026-03-08T12:15:00.000Z",
        outcomes: [
          { name: "Boston Celtics", price: -118 },
          { name: "New York Knicks", price: 102 }
        ]
      }
    ]
  });

  const availability = getMarketAvailabilityForBoard({
    normalized: [event],
    model: "weighted",
    minBooks: 3
  });

  assert.deepEqual(
    availability.map((entry) => [entry.market, entry.status]),
    [
      ["h2h", "active"],
      ["spreads", "limited"],
      ["totals", "unavailable"]
    ]
  );
});

test("getMarketAvailabilityForBoard keeps large-slate thin coverage as limited", () => {
  const primary = buildEvent();
  primary.event.id = "nba_primary";
  primary.books.push({
    book: { key: "fanduel", title: "FanDuel", tier: "mainstream", weight: 0.38, isSharpWeighted: false },
    markets: [
      {
        market: "h2h",
        lastUpdate: "2026-03-08T12:15:00.000Z",
        outcomes: [
          { name: "Boston Celtics", price: -118 },
          { name: "New York Knicks", price: 102 }
        ]
      }
    ]
  });

  const sparseEvents = Array.from({ length: 5 }, (_, idx) => {
    const event = buildEvent();
    event.event.id = `nba_sparse_${idx + 1}`;
    event.books = [
      {
        book: { key: "pinnacle", title: "Pinnacle", tier: "sharp", weight: 1, isSharpWeighted: true },
        markets: [
          {
            market: "h2h",
            lastUpdate: "2026-03-08T12:00:00.000Z",
            outcomes: [
              { name: "Boston Celtics", price: -125 },
              { name: "New York Knicks", price: 112 }
            ]
          }
        ]
      }
    ];
    return event;
  });

  const availability = getMarketAvailabilityForBoard({
    normalized: [primary, ...sparseEvents],
    model: "weighted",
    minBooks: 3
  });

  const h2h = availability.find((entry) => entry.market === "h2h");
  assert.equal(h2h?.feedEventCount, 6);
  assert.equal(h2h?.qualifiedEventCount, 1);
  assert.equal(h2h?.status, "limited");
});

test("representative spread point prefers broader consensus coverage over fringe groups", () => {
  const event = buildEvent();
  event.books.push({
    book: { key: "fanduel", title: "FanDuel", tier: "mainstream", weight: 0.38, isSharpWeighted: false },
    markets: [
      {
        market: "spreads",
        lastUpdate: "2026-03-08T12:15:00.000Z",
        outcomes: [
          { name: "Boston Celtics", price: -111, point: -3.5 },
          { name: "New York Knicks", price: -109, point: 3.5 }
        ]
      }
    ]
  });
  event.books.push({
    book: { key: "circa", title: "Circa", tier: "sharp", weight: 1, isSharpWeighted: true },
    markets: [
      {
        market: "spreads",
        lastUpdate: "2026-03-08T12:16:00.000Z",
        outcomes: [
          { name: "Boston Celtics", price: -103, point: -4 },
          { name: "New York Knicks", price: -117, point: 4 }
        ]
      }
    ]
  });

  const fairEvents = buildFairEventsForNormalizedEvent({
    normalized: event,
    sportKey: "basketball_nba",
    market: "spreads",
    model: "weighted",
    minBooks: 2
  });

  assert.deepEqual(
    fairEvents.map((entry) => entry.linePoint),
    [-3.5, -4]
  );
});

test("representative total point favors market-making quality over fringe pricing", () => {
  const event = buildEvent();
  event.books = [
    {
      book: { key: "pinnacle", title: "Pinnacle", tier: "sharp", weight: 1, isSharpWeighted: true },
      markets: [
        {
          market: "totals",
          lastUpdate: "2026-03-08T12:00:00.000Z",
          outcomes: [
            { name: "Over", price: -110, point: 228.5 },
            { name: "Under", price: -110, point: 228.5 }
          ]
        }
      ]
    },
    {
      book: { key: "draftkings", title: "DraftKings", tier: "mainstream", weight: 0.4, isSharpWeighted: false },
      markets: [
        {
          market: "totals",
          lastUpdate: "2026-03-08T12:05:00.000Z",
          outcomes: [
            { name: "Over", price: -112, point: 228.5 },
            { name: "Under", price: -108, point: 228.5 }
          ]
        }
      ]
    },
    {
      book: { key: "bovada", title: "Bovada", tier: "promo", weight: 0.18, isSharpWeighted: false },
      markets: [
        {
          market: "totals",
          lastUpdate: "2026-03-08T12:10:00.000Z",
          outcomes: [
            { name: "Over", price: 105, point: 229.5 },
            { name: "Under", price: -125, point: 229.5 }
          ]
        }
      ]
    },
    {
      book: { key: "mybookie", title: "MyBookie", tier: "promo", weight: 0.15, isSharpWeighted: false },
      markets: [
        {
          market: "totals",
          lastUpdate: "2026-03-08T12:11:00.000Z",
          outcomes: [
            { name: "Over", price: 108, point: 229.5 },
            { name: "Under", price: -128, point: 229.5 }
          ]
        }
      ]
    }
  ];

  const fairEvents = buildFairEventsForNormalizedEvent({
    normalized: event,
    sportKey: "basketball_nba",
    market: "totals",
    model: "weighted",
    minBooks: 2
  });

  assert.deepEqual(
    fairEvents.map((entry) => entry.linePoint),
    [228.5, 229.5]
  );
});
