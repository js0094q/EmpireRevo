import test from "node:test";
import assert from "node:assert/strict";
import { foldHistory } from "../lib/server/odds/movement";

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
