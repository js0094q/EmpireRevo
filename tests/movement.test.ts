import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLineMovementSummary,
  deriveValueTimingSignal,
  foldHistory
} from "../lib/server/odds/movement";
import { resetOddsHistoryConfigForTests } from "../lib/server/odds/historyConfig";
import type { StoredMarketTimeline } from "../lib/server/odds/historyStore";

function timeline(points: StoredMarketTimeline["points"]): StoredMarketTimeline {
  return {
    version: 2,
    sportKey: "basketball_nba",
    eventId: "evt-1",
    marketKey: "h2h:away",
    points
  };
}

test.beforeEach(() => {
  resetOddsHistoryConfigForTests();
});

test("foldHistory dedupes unchanged prices while keeping current state", () => {
  const now = new Date("2026-03-05T12:00:00.000Z");
  const first = foldHistory({
    currentPrice: -110,
    nowIso: now.toISOString(),
    windowMs: 60 * 60 * 1000,
    retentionMs: 60 * 60 * 1000,
    maxPoints: 200
  });

  const second = foldHistory({
    previous: {
      openPrice: first.openPrice,
      prevPrice: first.prevPrice,
      currentPrice: first.currentPrice,
      updatedAt: first.updatedAt,
      history: first.history
    },
    currentPrice: -110,
    nowIso: new Date(now.getTime() + 30_000).toISOString(),
    windowMs: 60 * 60 * 1000,
    retentionMs: 60 * 60 * 1000,
    maxPoints: 200
  });

  assert.equal(second.history.length, 1);
  assert.equal(second.delta, 0);
  assert.equal(second.move, 0);
});

test("foldHistory retains only recent points and caps max length", () => {
  const base = Date.parse("2026-03-05T00:00:00.000Z");
  let snapshot = foldHistory({
    currentPrice: -110,
    nowIso: new Date(base).toISOString(),
    windowMs: 24 * 60 * 60 * 1000,
    retentionMs: 24 * 60 * 60 * 1000,
    maxPoints: 3
  });

  const prices = [-105, -102, 101, 104];
  for (let idx = 0; idx < prices.length; idx += 1) {
    snapshot = foldHistory({
      previous: {
        openPrice: snapshot.openPrice,
        prevPrice: snapshot.prevPrice,
        currentPrice: snapshot.currentPrice,
        updatedAt: snapshot.updatedAt,
        history: snapshot.history
      },
      currentPrice: prices[idx],
      nowIso: new Date(base + (idx + 1) * 60_000).toISOString(),
      windowMs: 24 * 60 * 60 * 1000,
      retentionMs: 24 * 60 * 60 * 1000,
      maxPoints: 3
    });
  }

  assert.equal(snapshot.history.length, 3);
  assert.deepEqual(
    snapshot.history.map((point) => point.priceAmerican),
    [-102, 101, 104]
  );
});

test("buildLineMovementSummary captures point movement and velocity windows", () => {
  const summary = buildLineMovementSummary({
    nowMs: Date.parse("2026-03-05T12:06:00.000Z"),
    points: [
      { ts: Date.parse("2026-03-05T12:00:00.000Z"), priceAmerican: -110, point: -3.5 },
      { ts: Date.parse("2026-03-05T12:03:00.000Z"), priceAmerican: -105, point: -3 },
      { ts: Date.parse("2026-03-05T12:06:00.000Z"), priceAmerican: -102, point: -2.5 }
    ]
  });

  assert.ok(summary);
  assert.equal(summary?.openingPriceAmerican, -110);
  assert.equal(summary?.currentPriceAmerican, -102);
  assert.equal(summary?.priceDelta, 8);
  assert.equal(summary?.pointDelta, 1);
  assert.equal(summary?.direction, "up");
  assert.equal(summary?.observations, 3);
  assert.ok((summary?.velocityShortWindow || 0) > 0);
  assert.ok((summary?.velocityLongWindow || 0) > 0);
});

test("deriveValueTimingSignal classifies stable improving value from persisted history", () => {
  const signal = deriveValueTimingSignal({
    nowMs: Date.parse("2026-03-05T12:30:00.000Z"),
    timeline: timeline([
      {
        ts: Date.parse("2026-03-05T12:00:00.000Z"),
        snapshotKey: "snap-1",
        fairProb: 0.51,
        globalBestAmerican: 100,
        books: []
      },
      {
        ts: Date.parse("2026-03-05T12:10:00.000Z"),
        snapshotKey: "snap-2",
        fairProb: 0.51,
        globalBestAmerican: 102,
        books: []
      },
      {
        ts: Date.parse("2026-03-05T12:20:00.000Z"),
        snapshotKey: "snap-3",
        fairProb: 0.51,
        globalBestAmerican: 118,
        books: []
      },
      {
        ts: Date.parse("2026-03-05T12:30:00.000Z"),
        snapshotKey: "snap-4",
        fairProb: 0.51,
        globalBestAmerican: 125,
        books: []
      }
    ])
  });

  assert.equal(signal.valuePersistence, "stable");
  assert.equal(signal.edgeTrend, "improving");
  assert.equal(signal.firstPositiveEvAt, "2026-03-05T12:00:00.000Z");
  assert.equal(signal.lastPositiveEvAt, "2026-03-05T12:30:00.000Z");
  assert.ok((signal.positiveEvDurationSeconds || 0) >= 1800);
});

test("deriveValueTimingSignal marks old positive history as stale", () => {
  const signal = deriveValueTimingSignal({
    nowMs: Date.parse("2026-03-05T13:20:00.000Z"),
    timeline: timeline([
      {
        ts: Date.parse("2026-03-05T12:00:00.000Z"),
        snapshotKey: "snap-1",
        fairProb: 0.51,
        globalBestAmerican: 110,
        books: []
      },
      {
        ts: Date.parse("2026-03-05T12:10:00.000Z"),
        snapshotKey: "snap-2",
        fairProb: 0.51,
        globalBestAmerican: 108,
        books: []
      }
    ])
  });

  assert.equal(signal.valuePersistence, "stale");
  assert.equal(signal.edgeTrend, "unknown");
  assert.equal(signal.lastPositiveEvAt, "2026-03-05T12:10:00.000Z");
});
