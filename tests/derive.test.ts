import test from "node:test";
import assert from "node:assert/strict";
import type { NormalizedEventOdds } from "../lib/odds/schemas";
import { deriveGames } from "../lib/server/odds/derive";
import { calculateEvPercent } from "../lib/server/odds/ev";

function buildMoneylineEvent(): NormalizedEventOdds {
  return {
    event: {
      id: "nba_bulls_at_heat_2026-03-12",
      league: "nba",
      commenceTime: "2026-03-12T00:00:00.000Z",
      home: { id: "heat", name: "Miami Heat" },
      away: { id: "bulls", name: "Chicago Bulls" },
      status: "upcoming"
    },
    fetchedAt: "2026-03-11T15:00:00.000Z",
    books: [
      {
        book: { key: "pinnacle", title: "Pinnacle", tier: "sharp", weight: 1, isSharpWeighted: true },
        markets: [
          {
            market: "h2h",
            lastUpdate: "2026-03-11T15:00:00.000Z",
            outcomes: [
              { name: "Chicago Bulls", price: -120 },
              { name: "Miami Heat", price: 110 }
            ]
          }
        ]
      },
      {
        book: { key: "draftkings", title: "DraftKings", tier: "mainstream", weight: 0.4, isSharpWeighted: false },
        markets: [
          {
            market: "h2h",
            lastUpdate: "2026-03-11T15:05:00.000Z",
            outcomes: [
              { name: "Chicago Bulls", price: -115 },
              { name: "Miami Heat", price: 105 }
            ]
          }
        ]
      }
    ]
  };
}

function buildSpreadEvent(): NormalizedEventOdds {
  return {
    event: {
      id: "nba_suns_at_mavs_2026-03-12",
      league: "nba",
      commenceTime: "2026-03-12T02:00:00.000Z",
      home: { id: "mavs", name: "Dallas Mavericks" },
      away: { id: "suns", name: "Phoenix Suns" },
      status: "upcoming"
    },
    fetchedAt: "2026-03-11T16:00:00.000Z",
    books: [
      {
        book: { key: "book_a", title: "Book A", tier: "mainstream", weight: 0.35, isSharpWeighted: false },
        markets: [
          {
            market: "spreads",
            lastUpdate: "2026-03-11T16:00:00.000Z",
            outcomes: [
              { name: "Phoenix Suns", price: -110, point: -3.5 },
              { name: "Dallas Mavericks", price: -110, point: 3.5 }
            ]
          }
        ]
      },
      {
        book: { key: "book_b", title: "Book B", tier: "mainstream", weight: 0.34, isSharpWeighted: false },
        markets: [
          {
            market: "spreads",
            lastUpdate: "2026-03-11T16:02:00.000Z",
            outcomes: [
              { name: "Phoenix Suns", price: -125, point: -3 },
              { name: "Dallas Mavericks", price: 105, point: 3 }
            ]
          }
        ]
      }
    ]
  };
}

test("deriveGames uses canonical EV percent formula", () => {
  const { games } = deriveGames({
    normalized: [buildMoneylineEvent()],
    movementState: { openByKey: {}, prevByKey: {} },
    nowIso: "2026-03-11T16:10:00.000Z"
  });

  const side = games[0]?.markets.find((market) => market.market === "h2h")?.sides.find((entry) => entry.label === "Chicago Bulls");
  assert.ok(side);
  const expected = calculateEvPercent(side.fairProb, side.bestPrice.price);
  assert.ok(Math.abs(side.evPct - expected) < 1e-6);
});

test("deriveGames spread best-price selection prioritizes better point over payout", () => {
  const { games } = deriveGames({
    normalized: [buildSpreadEvent()],
    movementState: { openByKey: {}, prevByKey: {} },
    nowIso: "2026-03-11T16:10:00.000Z"
  });

  const spreadSides = games[0]?.markets.find((market) => market.market === "spreads")?.sides;
  assert.ok(spreadSides);
  const suns = spreadSides.find((side) => side.label === "Phoenix Suns");
  const mavs = spreadSides.find((side) => side.label === "Dallas Mavericks");
  assert.equal(suns?.bestPrice.bookKey, "book_b");
  assert.equal(mavs?.bestPrice.bookKey, "book_a");
});
