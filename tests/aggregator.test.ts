import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { getAggregatedOdds } from "@/lib/server/odds/aggregator";

const upstreamSpreads = [
  {
    sport_key: "basketball_nba",
    home_team: "Golden State Warriors",
    away_team: "Los Angeles Lakers",
    commence_time: "2026-03-10T02:00:00.000Z",
    bookmakers: [
      {
        key: "pinnacle",
        title: "Pinnacle",
        markets: [
          {
            key: "spreads",
            last_update: "2026-03-09T12:00:00.000Z",
            outcomes: [
              { name: "Los Angeles Lakers", price: -110, point: -2.5 },
              { name: "Golden State Warriors", price: -110, point: 2.5 }
            ]
          }
        ]
      },
      {
        key: "draftkings",
        title: "DraftKings",
        markets: [
          {
            key: "spreads",
            last_update: "2026-03-09T12:05:00.000Z",
            outcomes: [
              { name: "Los Angeles Lakers", price: -108, point: -2.5 },
              { name: "Golden State Warriors", price: -112, point: 2.5 }
            ]
          }
        ]
      }
    ]
  }
];

async function runWithMock(payload: any[], fn: () => Promise<void>) {
  const fetchMock = mock.method(globalThis, "fetch", async () => {
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  });
  const originalKey = process.env.ODDS_API_KEY;
  process.env.ODDS_API_KEY = "spread-key";
  try {
    await fn();
  } finally {
    fetchMock.mock.restore();
    if (originalKey === undefined) delete process.env.ODDS_API_KEY;
    else process.env.ODDS_API_KEY = originalKey;
  }
}

test("getAggregatedOdds returns point-aware spreads", async () => {
  await runWithMock(upstreamSpreads, async () => {
    const response = await getAggregatedOdds({ sportKey: "basketball_nba", market: "spreads" });
    assert.equal(response.games.length, 1);
    const game = response.games[0];
    const side = game.sides[0];
    assert.equal(side.linePoint, -2.5);
    const firstBook = side.sportsbooks[0];
    assert.equal(firstBook.point, -2.5);
    assert.ok(firstBook.lineMovement !== undefined);
    assert.ok(firstBook.movementDirection);
    assert.ok(firstBook.movementArrow);
    const expectedEdge = (side.fairProbability - firstBook.noVigProbability) * 100;
    assert.ok(Math.abs(firstBook.edge - expectedEdge) < 1e-6);

    const positiveEdgeBooks = side.sportsbooks
      .filter((line) => line.edge > 0)
      .map((line) => line.book)
      .sort();
    assert.deepEqual(
      side.edges
        .map((entry) => entry.book)
        .sort(),
      positiveEdgeBooks
    );
    assert.ok(side.edges.every((entry) => entry.edge > 0));
  });
});
