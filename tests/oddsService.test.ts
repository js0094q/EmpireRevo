import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { getFairBoard, getNormalizedOdds } from "@/lib/server/odds/oddsService";

const upstreamPayload = [
  {
    sport_key: "basketball_nba",
    home_team: "New York Knicks",
    away_team: "Boston Celtics",
    commence_time: "2026-03-09T00:00:00.000Z",
    bookmakers: [
      {
        key: "pinnacle",
        title: "Pinnacle",
        markets: [
          {
            key: "h2h",
            last_update: "2026-03-08T12:00:00.000Z",
            outcomes: [
              { name: "Boston Celtics", price: -120 },
              { name: "New York Knicks", price: 110 }
            ]
          }
        ]
      },
      {
        key: "draftkings",
        title: "DraftKings",
        markets: [
          {
            key: "h2h",
            last_update: "2026-03-08T12:10:00.000Z",
            outcomes: [
              { name: "Boston Celtics", price: -115 },
              { name: "New York Knicks", price: 105 }
            ]
          }
        ]
      }
    ]
  }
];

async function withMockedFetch<T>(fn: () => Promise<T>): Promise<T> {
  const fetchMock = mock.method(globalThis, "fetch", async () => {
    return new Response(JSON.stringify(upstreamPayload), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  });
  const originalKey = process.env.ODDS_API_KEY;
  process.env.ODDS_API_KEY = "test-key";
  try {
    return await fn();
  } finally {
    fetchMock.mock.restore();
    if (originalKey === undefined) delete process.env.ODDS_API_KEY;
    else process.env.ODDS_API_KEY = originalKey;
  }
}

test("getFairBoard attaches movement metadata", async () => {
  const board = await withMockedFetch(() =>
    getFairBoard({
      sportKey: "basketball_nba",
      market: "h2h",
      historyWindowHours: 1,
      minBooks: 2
    })
  );

  assert.equal(board.events.length, 1);
  const firstBook = board.events[0].outcomes[0].books[0];
  assert.ok(firstBook.movement, "book should include movement state");
  assert.equal(typeof firstBook.movement?.openPrice, "number");
});

test("getFairBoard reuses provided normalized result", async () => {
  await withMockedFetch(async () => {
    const normalized = await getNormalizedOdds({ sportKey: "basketball_nba", markets: "h2h" });
    const board = await getFairBoard({
      market: "h2h",
      minBooks: 2,
      normalizedResult: normalized
    });
    assert.equal(board.sportKey, "basketball_nba");
    assert.equal(board.events.length, 1);
  });
});

test("getFairBoard defaults to minBooks = 4 when no threshold is provided", async () => {
  const board = await withMockedFetch(() =>
    getFairBoard({
      sportKey: "basketball_nba",
      market: "h2h"
    })
  );

  assert.equal(board.events.length, 0);
});
