import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/board/route";
import { americanToDecimal } from "../lib/server/odds/fairMath";

test("GET /api/board derives EV from canonical fair-board math", async () => {
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
              last_update: "2026-03-08T12:05:00.000Z",
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

  const fetchMock = mock.method(globalThis, "fetch", async () => {
    return new Response(JSON.stringify(upstreamPayload), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  });

  const originalKey = process.env.ODDS_API_KEY;
  process.env.ODDS_API_KEY = "test-key";

  const response = await GET(new Request("http://localhost/api/board?sport=nba&markets=h2h&model=weighted&minBooks=2"));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.games.length, 1);
  const market = payload.games[0].markets.find((entry: { market: string }) => entry.market === "h2h");
  assert.ok(market);
  const side = market.sides[0];
  const expectedEv = (side.fairProb * americanToDecimal(side.bestPrice.price) - 1) * 100;

  assert.ok(Math.abs(side.evPct - expectedEv) < 1e-6);

  fetchMock.mock.restore();
  if (originalKey === undefined) {
    delete process.env.ODDS_API_KEY;
  } else {
    process.env.ODDS_API_KEY = originalKey;
  }
});

test("GET /api/board keeps spreads point-aware when picking the representative best line", async () => {
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
              key: "spreads",
              last_update: "2026-03-08T12:00:00.000Z",
              outcomes: [
                { name: "Boston Celtics", price: -110, point: -3.5 },
                { name: "New York Knicks", price: -110, point: 3.5 }
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
              last_update: "2026-03-08T12:05:00.000Z",
              outcomes: [
                { name: "Boston Celtics", price: -108, point: -3.5 },
                { name: "New York Knicks", price: -112, point: 3.5 }
              ]
            }
          ]
        },
        {
          key: "bovada",
          title: "Bovada",
          markets: [
            {
              key: "spreads",
              last_update: "2026-03-08T12:10:00.000Z",
              outcomes: [
                { name: "Boston Celtics", price: 105, point: -4 },
                { name: "New York Knicks", price: -125, point: 4 }
              ]
            }
          ]
        }
      ]
    }
  ];

  const fetchMock = mock.method(globalThis, "fetch", async () => {
    return new Response(JSON.stringify(upstreamPayload), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  });

  const originalKey = process.env.ODDS_API_KEY;
  process.env.ODDS_API_KEY = "test-key";

  const response = await GET(new Request("http://localhost/api/board?sport=nba&markets=spreads&model=weighted&minBooks=2"));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.games.length, 1);
  const market = payload.games[0].markets.find((entry: { market: string }) => entry.market === "spreads");
  assert.ok(market);
  const celticsSide = market.sides.find((side: { label: string }) => side.label === "Boston Celtics");
  assert.ok(celticsSide);
  assert.equal(celticsSide.bestPrice.bookKey, "draftkings");

  fetchMock.mock.restore();
  if (originalKey === undefined) {
    delete process.env.ODDS_API_KEY;
  } else {
    process.env.ODDS_API_KEY = originalKey;
  }
});
