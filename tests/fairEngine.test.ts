import test from "node:test";
import assert from "node:assert/strict";
import type { NormalizedEventOdds } from "../lib/odds/schemas";
import { buildFairBoard } from "../lib/server/odds/fairEngine";
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

  const sampleBook = firstOutcome.books[0]!;
  const expectedEdge = (firstOutcome.fairProb - sampleBook.impliedProbNoVig) * 100;
  const expectedEv = (firstOutcome.fairProb * americanToDecimal(sampleBook.priceAmerican) - 1) * 100;
  assert.ok(Math.abs(sampleBook.edgePct - expectedEdge) < 1e-6);
  assert.ok(Math.abs(sampleBook.evPct - expectedEv) < 1e-6);
  assert.notEqual(sampleBook.edgePct.toFixed(4), sampleBook.evPct.toFixed(4));
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
