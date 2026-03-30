import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/internal/snapshots/collect/route";
import { resetOddsHistoryConfigForTests } from "../lib/server/odds/historyConfig";
import {
  listRecentEventHistory,
  readMarketSnapshotByKey,
  readMarketTimeline
} from "../lib/server/odds/historyStore";
import { resetPersistenceForTests } from "../lib/server/odds/persistence";
import { buildOutcomeMarketKey } from "../lib/server/odds/snapshotPersistence";
import { collectHistoricalSnapshots } from "../lib/server/odds/snapshots";

const INTERNAL_TEST_KEY = "internal-snapshots-test-key";

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

async function withMockedFetch<T>(payload: unknown, fn: () => Promise<T>): Promise<T> {
  const fetchMock = mock.method(globalThis, "fetch", async () => {
    return new Response(JSON.stringify(payload), {
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

test.beforeEach(() => {
  resetPersistenceForTests();
  resetOddsHistoryConfigForTests();
  process.env.EMPIRE_INTERNAL_API_KEY = INTERNAL_TEST_KEY;
  delete process.env.ODDS_SNAPSHOT_COLLECTION_ENABLED;
  delete process.env.ODDS_SNAPSHOT_INTERVAL_SECONDS;
  delete process.env.ODDS_SNAPSHOT_RETENTION_HOURS;
  delete process.env.ODDS_SNAPSHOT_BATCH_SIZE;
  delete process.env.ODDS_HISTORY_SHORT_WINDOW_MINUTES;
  delete process.env.ODDS_HISTORY_LONG_WINDOW_MINUTES;
  delete process.env.ODDS_VALUE_PERSISTENCE_THRESHOLD_PCT;
});

test.after(() => {
  delete process.env.EMPIRE_INTERNAL_API_KEY;
  delete process.env.ODDS_SNAPSHOT_COLLECTION_ENABLED;
  delete process.env.ODDS_SNAPSHOT_INTERVAL_SECONDS;
  delete process.env.ODDS_SNAPSHOT_RETENTION_HOURS;
  delete process.env.ODDS_SNAPSHOT_BATCH_SIZE;
  delete process.env.ODDS_HISTORY_SHORT_WINDOW_MINUTES;
  delete process.env.ODDS_HISTORY_LONG_WINDOW_MINUTES;
  delete process.env.ODDS_VALUE_PERSISTENCE_THRESHOLD_PCT;
});

test("collectHistoricalSnapshots persists granular normalized snapshots and duplicate runs are survivable", async () => {
  await withMockedFetch(upstreamPayload, async () => {
    const fixedNow = Date.parse("2026-03-08T12:15:00.000Z");
    const nowMock = mock.method(Date, "now", () => fixedNow);
    try {
      const first = await collectHistoricalSnapshots({
        sportKey: "basketball_nba",
        markets: ["h2h"]
      });
      const second = await collectHistoricalSnapshots({
        sportKey: "basketball_nba",
        markets: ["h2h"]
      });

      assert.equal(first.eventsProcessed, 1);
      assert.equal(first.snapshotsWritten, 4);
      assert.equal(first.failures, 0);
      assert.equal(second.eventsProcessed, 1);
      assert.equal(second.snapshotsWritten, 4);
      assert.equal(second.failures, 0);

      const recent = await listRecentEventHistory(5);
      assert.equal(recent.length, 1);
      const eventId = recent[0]?.eventId;
      assert.ok(eventId);

      const marketKey = buildOutcomeMarketKey("h2h", "Boston Celtics");
      const timeline = await readMarketTimeline("basketball_nba", eventId!, marketKey);
      assert.ok(timeline);
      assert.equal(timeline?.points.length, 1);
      assert.equal(timeline?.points[0]?.observationCount, 2);

      const snapshot = await readMarketSnapshotByKey(timeline?.points[0]?.snapshotKey || "");
      assert.ok(snapshot);
      assert.equal(snapshot?.eventId, eventId);
      assert.equal(snapshot?.marketKey, marketKey);
      assert.equal(snapshot?.snapshots.length, 2);
      assert.equal(snapshot?.snapshots[0]?.outcomeLabel, "Boston Celtics");
      assert.equal(snapshot?.snapshots[0]?.bookmakerKey, "draftkings");
      assert.equal(snapshot?.snapshots[0]?.priceAmerican, -115);
      assert.equal(snapshot?.snapshots[1]?.bookmakerKey, "pinnacle");
      assert.equal(snapshot?.snapshots[1]?.priceAmerican, -120);
    } finally {
      nowMock.mock.restore();
    }
  });
});

test("collectHistoricalSnapshots returns an empty non-fatal summary when no events are available", async () => {
  await withMockedFetch([], async () => {
    const summary = await collectHistoricalSnapshots({
      sportKey: "basketball_nba",
      markets: ["h2h"]
    });

    assert.equal(summary.ok, true);
    assert.equal(summary.eventsProcessed, 0);
    assert.equal(summary.snapshotsWritten, 0);
    assert.equal(summary.failures, 0);

    const recent = await listRecentEventHistory(5);
    assert.equal(recent.length, 0);
  });
});

test("internal snapshot collection route enforces auth, respects disabled mode, and allows force bypass", async () => {
  process.env.ODDS_SNAPSHOT_COLLECTION_ENABLED = "false";
  resetOddsHistoryConfigForTests();

  const unauthorized = await GET(new Request("http://localhost/api/internal/snapshots/collect"));
  const unauthorizedPayload = await unauthorized.json();
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorizedPayload.ok, false);

  const disabled = await GET(
    new Request("http://localhost/api/internal/snapshots/collect", {
      headers: {
        "x-empire-internal-key": INTERNAL_TEST_KEY
      }
    })
  );
  const disabledPayload = await disabled.json();
  assert.equal(disabled.status, 409);
  assert.equal(disabledPayload.error.code, "SNAPSHOT_COLLECTION_DISABLED");

  await withMockedFetch(upstreamPayload, async () => {
    const forced = await GET(
      new Request("http://localhost/api/internal/snapshots/collect?force=1&sportKey=basketball_nba&regions=us2&markets=h2h", {
        headers: {
          "x-empire-internal-key": INTERNAL_TEST_KEY
        }
      })
    );
    const payload = await forced.json();

    assert.equal(forced.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.eventsProcessed, 1);
    assert.equal(payload.snapshotsWritten, 4);
    assert.equal(payload.failures, 0);
    assert.equal(payload.configuredIntervalSeconds, 60);
    assert.equal(payload.fallbackMode, "memory");
  });
});
