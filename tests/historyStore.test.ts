import test from "node:test";
import assert from "node:assert/strict";
import type { PersistedMarketSnapshot } from "../lib/server/odds/types";
import {
  readMarketSnapshot,
  readMarketTimeline,
  writeMarketSnapshot
} from "../lib/server/odds/historyStore";
import { resetPersistenceForTests } from "../lib/server/odds/persistence";

function snapshot(capturedAt: number, fairAmerican: number): PersistedMarketSnapshot {
  return {
    version: 1,
    capturedAt,
    sportKey: "basketball_nba",
    eventId: "evt-1",
    marketKey: "h2h:away",
    marketType: "h2h",
    fair: {
      fairProb: 0.52,
      fairAmerican
    },
    diagnostics: {
      rankingScore: 66,
      confidenceScore: 0.72,
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
        bookKey: "pinnacle",
        bookTitle: "Pinnacle",
        bookTier: "sharp",
        isPinned: false,
        isSharp: true,
        isBestPrice: true,
        lastSeenAt: capturedAt,
        outcomes: [
          {
            name: "Away",
            priceAmerican: -104,
            impliedProb: 0.51,
            noVigProb: 0.5,
            point: null
          }
        ]
      }
    ]
  };
}

test.beforeEach(() => {
  resetPersistenceForTests();
});

test("history store writes and reads snapshots and timeline", async () => {
  const baseTs = Date.now() - 5 * 60 * 1000;
  const first = await writeMarketSnapshot(snapshot(baseTs, -110));
  const stored = await readMarketSnapshot("basketball_nba", "evt-1", "h2h:away", first.bucketTs);

  assert.ok(stored);
  assert.equal(stored?.version, 1);
  assert.equal(stored?.fair?.fairAmerican, -110);

  const timeline = await readMarketTimeline("basketball_nba", "evt-1", "h2h:away");
  assert.ok(timeline);
  assert.equal(timeline?.points.length, 1);
  assert.equal(timeline?.points[0]?.globalBestAmerican, -104);
});

test("history store upserts same bucket timestamp without duplicate points", async () => {
  const baseTs = Date.now() - 5 * 60 * 1000;
  await writeMarketSnapshot(snapshot(baseTs, -110));
  await writeMarketSnapshot(snapshot(baseTs + 123, -108));

  const timeline = await readMarketTimeline("basketball_nba", "evt-1", "h2h:away");
  assert.ok(timeline);
  assert.equal(timeline?.points.length, 1);
  assert.equal(timeline?.points[0]?.fairAmerican, -108);
});
