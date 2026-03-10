import test from "node:test";
import assert from "node:assert/strict";
import type { NormalizedEventOdds } from "../lib/odds/schemas";
import { buildFairBoard } from "../lib/server/odds/fairEngine";

function spreadEvent(bookCount: number): NormalizedEventOdds {
  const now = Date.now();
  const allBooks = [
    {
      key: "pinnacle",
      title: "Pinnacle",
      tier: "sharp" as const,
      weight: 1,
      isSharpWeighted: true,
      priceA: -110,
      priceB: -110
    },
    {
      key: "fanduel",
      title: "FanDuel",
      tier: "mainstream" as const,
      weight: 0.38,
      isSharpWeighted: false,
      priceA: -108,
      priceB: -112
    },
    {
      key: "draftkings",
      title: "DraftKings",
      tier: "mainstream" as const,
      weight: 0.4,
      isSharpWeighted: false,
      priceA: -109,
      priceB: -111
    }
  ].slice(0, bookCount);

  return {
    event: {
      id: `evt-${bookCount}`,
      league: "nba",
      commenceTime: "2026-03-09T00:00:00.000Z",
      home: { id: "home", name: "Home" },
      away: { id: "away", name: "Away" },
      status: "upcoming"
    },
    fetchedAt: "2026-03-08T12:00:00.000Z",
    books: allBooks.map((book, idx) => ({
      book: {
        key: book.key,
        title: book.title,
        tier: book.tier,
        weight: book.weight,
        isSharpWeighted: book.isSharpWeighted
      },
      markets: [
        {
          market: "spreads",
          lastUpdate: new Date(now - idx * 60_000).toISOString(),
          outcomes: [
            { name: "Away", price: book.priceA, point: -3.5 },
            { name: "Home", price: book.priceB, point: 3.5 }
          ]
        }
      ]
    }))
  };
}

test("spread EV is suppressed when coverage is too thin", async () => {
  const board = await buildFairBoard({
    normalized: [spreadEvent(2)],
    league: "nba",
    sportKey: "basketball_nba",
    market: "spreads",
    minBooks: 2,
    timeWindowHours: 24
  });

  const outcome = board.events[0]?.outcomes[0];
  assert.equal(outcome?.evReliability, "suppressed");
  assert.ok(outcome?.books.every((book) => book.evPct === 0));
});

test("spread EV can be qualified when coverage and confidence are stronger", async () => {
  const board = await buildFairBoard({
    normalized: [spreadEvent(3)],
    league: "nba",
    sportKey: "basketball_nba",
    market: "spreads",
    minBooks: 3,
    timeWindowHours: 24
  });

  const outcome = board.events[0]?.outcomes[0];
  assert.equal(outcome?.evReliability, "qualified");
  assert.ok(outcome?.books.some((book) => book.evPct !== 0));
});
