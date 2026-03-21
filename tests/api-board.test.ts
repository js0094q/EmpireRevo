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

test("GET /api/board rejects invalid query values before upstream fetch", async () => {
  let fetchCalled = false;
  const fetchMock = mock.method(globalThis, "fetch", async () => {
    fetchCalled = true;
    return new Response("[]", { status: 200 });
  });

  const response = await GET(new Request("http://localhost/api/board?model=unsupported-model"));
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "BAD_REQUEST");
  assert.equal(fetchCalled, false);
  fetchMock.mock.restore();
});

test("GET /api/board maps upstream rate-limit failures", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => {
    return new Response("rate limit", { status: 429 });
  });

  const originalKey = process.env.ODDS_API_KEY;
  process.env.ODDS_API_KEY = "test-key";

  const response = await GET(
    new Request("http://localhost/api/board?sport=nba&regions=eu&markets=totals&model=equal&minBooks=3")
  );
  const payload = await response.json();

  assert.equal(response.status, 429);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "UPSTREAM_RATE_LIMIT");

  fetchMock.mock.restore();
  if (originalKey === undefined) {
    delete process.env.ODDS_API_KEY;
  } else {
    process.env.ODDS_API_KEY = originalKey;
  }
});

test("GET /api/board sanitizes upstream 5xx payload details", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => {
    return new Response("secret upstream payload should never leak", { status: 500 });
  });

  const originalKey = process.env.ODDS_API_KEY;
  process.env.ODDS_API_KEY = "test-key";

  const response = await GET(
    new Request("http://localhost/api/board?sport=nba&regions=uk&markets=h2h&model=sharp&minBooks=2")
  );
  const payload = await response.json();

  assert.equal(response.status, 502);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "UPSTREAM_ERROR");
  assert.equal(typeof payload.error.message, "string");
  assert.equal(payload.error.message.includes("secret upstream payload"), false);

  fetchMock.mock.restore();
  if (originalKey === undefined) {
    delete process.env.ODDS_API_KEY;
  } else {
    process.env.ODDS_API_KEY = originalKey;
  }
});

test("GET /api/board keeps alternate spread and total line groups in the merged legacy response", async () => {
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
            },
            {
              key: "totals",
              last_update: "2026-03-08T12:00:00.000Z",
              outcomes: [
                { name: "Over", price: -110, point: 216.5 },
                { name: "Under", price: -110, point: 216.5 }
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
              last_update: "2026-03-08T12:02:00.000Z",
              outcomes: [
                { name: "Boston Celtics", price: -108, point: -3.5 },
                { name: "New York Knicks", price: -112, point: 3.5 }
              ]
            },
            {
              key: "totals",
              last_update: "2026-03-08T12:02:00.000Z",
              outcomes: [
                { name: "Over", price: -108, point: 216.5 },
                { name: "Under", price: -112, point: 216.5 }
              ]
            }
          ]
        },
        {
          key: "fanatics",
          title: "Fanatics",
          markets: [
            {
              key: "spreads",
              last_update: "2026-03-08T12:04:00.000Z",
              outcomes: [
                { name: "Boston Celtics", price: -105, point: -4 },
                { name: "New York Knicks", price: -115, point: 4 }
              ]
            },
            {
              key: "totals",
              last_update: "2026-03-08T12:04:00.000Z",
              outcomes: [
                { name: "Over", price: -105, point: 217.5 },
                { name: "Under", price: -115, point: 217.5 }
              ]
            }
          ]
        },
        {
          key: "caesars",
          title: "Caesars",
          markets: [
            {
              key: "spreads",
              last_update: "2026-03-08T12:05:00.000Z",
              outcomes: [
                { name: "Boston Celtics", price: -102, point: -4 },
                { name: "New York Knicks", price: -118, point: 4 }
              ]
            },
            {
              key: "totals",
              last_update: "2026-03-08T12:05:00.000Z",
              outcomes: [
                { name: "Over", price: -102, point: 217.5 },
                { name: "Under", price: -118, point: 217.5 }
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

  const response = await GET(
    new Request("http://localhost/api/board?sport=nba&regions=us&markets=spreads,totals&model=weighted&minBooks=2")
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.games.length, 1);

  const markets = payload.games[0].markets as Array<{ market: string; linePoint?: number }>;
  const spreadPoints = markets.filter((entry) => entry.market === "spreads").map((entry) => entry.linePoint);
  const totalPoints = markets.filter((entry) => entry.market === "totals").map((entry) => entry.linePoint);

  assert.deepEqual(spreadPoints, [-4, -3.5]);
  assert.deepEqual(totalPoints, [216.5, 217.5]);

  fetchMock.mock.restore();
  if (originalKey === undefined) {
    delete process.env.ODDS_API_KEY;
  } else {
    process.env.ODDS_API_KEY = originalKey;
  }
});
