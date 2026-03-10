import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/fair/route";

test("GET /api/fair returns a stable payload", async () => {
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
              last_update: "2026-03-08T12:00:00.000Z",
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

  const response = await GET(
    new Request("http://localhost/api/fair?sportKey=basketball_nba_teststable&model=weighted&windowHours=17&minBooks=2")
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.market, "h2h");
  assert.equal(payload.model, "weighted");
  assert.equal(payload.events.length, 1);
  assert.equal(payload.events[0].outcomes.length, 2);
  assert.equal(payload.events[0].bookCount, 2);
  assert.ok(Array.isArray(payload.topOpportunities));
  const firstBook = payload.events[0].outcomes[0].books[0];
  assert.ok(firstBook);
  assert.ok(typeof firstBook.evPct === "number");
  assert.notEqual(firstBook.edgePct.toFixed(4), firstBook.evPct.toFixed(4));
  assert.ok(firstBook.movement);

  fetchMock.mock.restore();
  if (originalKey === undefined) {
    delete process.env.ODDS_API_KEY;
  } else {
    process.env.ODDS_API_KEY = originalKey;
  }
});

test("GET /api/fair maps upstream rate-limit failures", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => {
    return new Response("rate limit", { status: 429 });
  });

  const originalKey = process.env.ODDS_API_KEY;
  process.env.ODDS_API_KEY = "test-key";

  const response = await GET(
    new Request("http://localhost/api/fair?sportKey=basketball_nba_ratelimit&model=equal&windowHours=5&minBooks=2")
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
