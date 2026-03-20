import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/internal/timeline/route";
import { resetPersistenceForTests, setRedisOverrideForTests } from "../lib/server/odds/persistence";
import { createMockRedis } from "./mockRedis";
import { writeMarketSnapshot } from "../lib/server/odds/historyStore";
import type { PersistedMarketSnapshot } from "../lib/server/odds/types";

const INTERNAL_TEST_KEY = "internal-test-key";

function snapshot(capturedAt: number): PersistedMarketSnapshot {
  return {
    version: 1,
    capturedAt,
    sportKey: "basketball_nba",
    eventId: "evt-timeline-route",
    marketKey: "h2h:away",
    marketType: "h2h",
    fair: {
      fairProb: 0.52,
      fairAmerican: -108
    },
    diagnostics: {
      rankingScore: 65,
      confidenceScore: 0.7,
      stalePenalty: 0.3,
      timingPenalty: 0.2,
      coveragePenalty: 0.1,
      evDefensibility: "full",
      penaltyReasons: [],
      factorBreakdown: {
        edge: 0.2
      }
    },
    books: [
      {
        bookKey: "sharp-a",
        bookTitle: "Sharp A",
        bookTier: "sharp",
        isPinned: false,
        isSharp: true,
        isBestPrice: true,
        lastSeenAt: capturedAt,
        outcomes: [
          {
            name: "Away",
            point: null,
            priceAmerican: -104,
            impliedProb: 0.51,
            noVigProb: 0.5
          }
        ]
      }
    ]
  };
}

test.beforeEach(() => {
  resetPersistenceForTests();
  setRedisOverrideForTests(null);
  process.env.EMPIRE_INTERNAL_API_KEY = INTERNAL_TEST_KEY;
});

test.after(() => {
  delete process.env.EMPIRE_INTERNAL_API_KEY;
});

test("timeline route rejects unauthenticated requests", async () => {
  const res = await GET(
    new Request("http://localhost/api/internal/timeline?sportKey=basketball_nba&eventId=evt&marketKey=h2h%3Aaway")
  );
  const payload = await res.json();

  assert.equal(res.status, 401);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "UNAUTHORIZED");
});

test("timeline route fails closed when persistence unavailable", async () => {
  const res = await GET(
    new Request("http://localhost/api/internal/timeline?sportKey=basketball_nba&eventId=evt&marketKey=h2h%3Aaway", {
      headers: {
        "x-empire-internal-key": INTERNAL_TEST_KEY
      }
    })
  );
  const payload = await res.json();

  assert.equal(res.status, 503);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "PERSISTENCE_UNAVAILABLE");
});

test("timeline route returns persisted timeline and pressure signals", async () => {
  const redis = createMockRedis();
  setRedisOverrideForTests(redis.client);

  await writeMarketSnapshot(snapshot(1_710_000_000_000));
  await writeMarketSnapshot(snapshot(1_710_000_120_000));

  const res = await GET(
    new Request(
      "http://localhost/api/internal/timeline?sportKey=basketball_nba&eventId=evt-timeline-route&marketKey=h2h%3Aaway&rolling=50",
      {
        headers: {
          "x-empire-internal-key": INTERNAL_TEST_KEY
        }
      }
    )
  );
  const payload = await res.json();

  assert.equal(res.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.timeline.eventId, "evt-timeline-route");
  assert.ok(Array.isArray(payload.timeline.points));
  assert.ok(Array.isArray(payload.pressureSignals));
});
