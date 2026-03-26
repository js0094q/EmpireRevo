import test from "node:test";
import assert from "node:assert/strict";
import type { NormalizedEventOdds } from "../lib/odds/schemas";
import { buildFairEventsForNormalizedEvent } from "../lib/server/odds/fairEngine";

function buildEvent(): NormalizedEventOdds {
  return {
    event: {
      id: "nba_lakers_at_celtics_2026-03-10",
      league: "nba",
      commenceTime: "2026-03-10T00:00:00.000Z",
      home: { id: "celtics", name: "Boston Celtics" },
      away: { id: "lakers", name: "Los Angeles Lakers" },
      status: "upcoming"
    },
    fetchedAt: "2026-03-09T12:00:00.000Z",
    books: [
      {
        book: { key: "pinnacle", title: "Pinnacle", tier: "sharp", weight: 1, isSharpWeighted: true },
        markets: [
          {
            market: "h2h",
            lastUpdate: "2026-03-09T12:00:00.000Z",
            outcomes: [
              { name: "Los Angeles Lakers", price: 120 },
              { name: "Boston Celtics", price: -132 }
            ]
          }
        ]
      },
      {
        book: { key: "circa", title: "Circa", tier: "sharp", weight: 0.9, isSharpWeighted: true },
        markets: [
          {
            market: "h2h",
            lastUpdate: "2026-03-09T12:01:00.000Z",
            outcomes: [
              { name: "Los Angeles Lakers", price: 118 },
              { name: "Boston Celtics", price: -130 }
            ]
          }
        ]
      },
      {
        book: { key: "draftkings", title: "DraftKings", tier: "mainstream", weight: 0.4, isSharpWeighted: false },
        markets: [
          {
            market: "h2h",
            lastUpdate: "2026-03-09T12:02:00.000Z",
            outcomes: [
              { name: "Los Angeles Lakers", price: 125 },
              { name: "Boston Celtics", price: -145 }
            ]
          }
        ]
      }
    ]
  };
}

test("sharp model excludes non-tier-one books from fair-event construction", () => {
  const events = buildFairEventsForNormalizedEvent({
    normalized: buildEvent(),
    sportKey: "basketball_nba",
    market: "h2h",
    model: "sharp",
    minBooks: 2
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]?.bookCount, 2);
  assert.equal(events[0]?.totalBookCount, 2);
  assert.deepEqual(
    events[0]?.outcomes[0]?.books.map((book) => book.bookKey).sort(),
    ["circa", "pinnacle"]
  );
});
