import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPropBoardRows,
  fetchPropsBoardData,
  groupPropOutcomes,
  propsCacheKey,
  type NormalizedPropOutcome
} from "../lib/server/odds/propsService";

function makeOutcome(overrides: Partial<NormalizedPropOutcome> = {}): NormalizedPropOutcome {
  return {
    eventId: "provider-event-1",
    routeEventId: "route-event-1",
    sportKey: "baseball_mlb",
    commenceTime: "2099-01-01T00:00:00.000Z",
    eventLabel: "Away at Home",
    marketKey: "batter_hits",
    marketLabel: "Batter Hits",
    marketFamily: "player_prop",
    participant: "Player A",
    outcomeName: "Over",
    side: "over",
    line: 1.5,
    price: 110,
    bookKey: "fanduel",
    bookTitle: "FanDuel",
    lastUpdate: "2098-12-31T23:00:00.000Z",
    ...overrides
  };
}

test("props cache keys include event, prop type, markets, regions, and books", () => {
  const key = propsCacheKey({
    sportKey: "baseball_mlb",
    eventId: "event-123",
    propType: "player",
    markets: ["batter_hits", "pitcher_strikeouts"],
    regions: "us",
    books: ["draftkings", "fanduel"],
    oddsFormat: "american"
  });

  assert.match(key, /^props\|baseball_mlb\|event-123\|player\|/);
  assert.match(key, /batter_hits_pitcher_strikeouts/);
  assert.match(key, /\|us\|draftkings_fanduel\|american$/);
});

test("prop grouping keeps different markets and line values separate", () => {
  const groups = groupPropOutcomes([
    makeOutcome({ marketKey: "batter_hits", line: 0.5 }),
    makeOutcome({ marketKey: "batter_hits", line: 1.5 }),
    makeOutcome({ marketKey: "batter_total_bases", marketLabel: "Batter Total Bases", line: 1.5 })
  ]);

  assert.equal(groups.length, 3);
});

test("prop EV is available only for comparable paired outcomes", () => {
  const rows = buildPropBoardRows({
    league: "mlb",
    propType: "player",
    minBooks: 1,
    outcomes: [
      makeOutcome({ side: "over", outcomeName: "Over", price: 110 }),
      makeOutcome({ side: "under", outcomeName: "Under", price: -120 })
    ]
  });

  assert.equal(rows.length, 2);
  assert.ok(rows.every((row) => row.status === "EV available"));
  assert.ok(rows.every((row) => row.evPct !== null));
});

test("one-sided and sparse prop markets suppress EV", () => {
  const oneSided = buildPropBoardRows({
    league: "mlb",
    propType: "player",
    minBooks: 1,
    outcomes: [
      makeOutcome({ bookKey: "fanduel", bookTitle: "FanDuel", side: "over", outcomeName: "Over", price: 110 }),
      makeOutcome({ bookKey: "draftkings", bookTitle: "DraftKings", side: "over", outcomeName: "Over", price: 105 })
    ]
  });
  const sparse = buildPropBoardRows({
    league: "mlb",
    propType: "player",
    minBooks: 2,
    outcomes: [
      makeOutcome({ side: "over", outcomeName: "Over", price: 110 }),
      makeOutcome({ side: "under", outcomeName: "Under", price: -120 })
    ]
  });

  assert.equal(oneSided[0]?.evPct, null);
  assert.equal(oneSided[0]?.status, "Line shopping only");
  assert.ok(sparse.every((row) => row.evPct === null));
  assert.ok(sparse.every((row) => row.status === "Sparse coverage"));
});

test("props main fetch path does not call event odds upstream", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = ((async () => {
    calls += 1;
    throw new Error("fetch should not run for props main lines");
  }) as unknown) as typeof fetch;

  try {
    const data = await fetchPropsBoardData({
      league: "college_baseball",
      propType: "main",
      events: [
        {
          providerEventId: "provider-event-1",
          routeEventId: "route-event-1",
          sportKey: "baseball_ncaa",
          commenceTime: "2099-01-01T00:00:00.000Z",
          homeTeam: "Home",
          awayTeam: "Away"
        }
      ]
    });

    assert.equal(calls, 0);
    assert.deepEqual(data.requestedMarkets, ["h2h", "spreads", "totals"]);
    assert.equal(data.marketFamily, "main");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
