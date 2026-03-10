import test from "node:test";
import assert from "node:assert/strict";
import type { PersistedMarketSnapshot } from "../lib/server/odds/types";
import { writeMarketSnapshot } from "../lib/server/odds/historyStore";
import { resetPersistenceForTests } from "../lib/server/odds/persistence";
import { buildMarketTimeline } from "../lib/server/odds/timeline";

function makeSnapshot(capturedAt: number, fair: number, bookPrice: number): PersistedMarketSnapshot {
  return {
    version: 1,
    capturedAt,
    sportKey: "basketball_nba",
    eventId: "evt-timeline",
    marketKey: "h2h:away",
    marketType: "h2h",
    fair: {
      fairProb: 0.5,
      fairAmerican: fair
    },
    diagnostics: {
      rankingScore: 60,
      confidenceScore: 0.7,
      stalePenalty: 0.2,
      timingPenalty: 0.1,
      coveragePenalty: 0.1,
      evDefensibility: "full",
      penaltyReasons: [],
      factorBreakdown: {
        edge: 0.2
      }
    },
    books: [
      {
        bookKey: "book-a",
        bookTitle: "Book A",
        bookTier: "mainstream",
        isPinned: false,
        isSharp: false,
        isBestPrice: true,
        lastSeenAt: capturedAt,
        outcomes: [
          {
            name: "Away",
            priceAmerican: bookPrice,
            impliedProb: 0.5,
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

test("timeline returns open/current from actual persisted snapshots", async () => {
  const baseTs = Date.now() - 15 * 60 * 1000;
  await writeMarketSnapshot(makeSnapshot(baseTs, -110, -105));
  await writeMarketSnapshot(makeSnapshot(baseTs + 120_000, -108, -103));
  await writeMarketSnapshot(makeSnapshot(baseTs + 240_000, -106, -101));

  const timeline = await buildMarketTimeline({
    sportKey: "basketball_nba",
    eventId: "evt-timeline",
    marketKey: "h2h:away"
  });

  assert.equal(timeline.points.length, 3);
  assert.equal(timeline.openTs, timeline.points[0]?.ts);
  assert.equal(timeline.currentTs, timeline.points[2]?.ts);
  assert.equal(timeline.points[2]?.globalBestAmerican, -101);
});

test("timeline does not fabricate open point when sparse", async () => {
  const baseTs = Date.now() - 5 * 60 * 1000;
  await writeMarketSnapshot(makeSnapshot(baseTs, -110, -105));

  const timeline = await buildMarketTimeline({
    sportKey: "basketball_nba",
    eventId: "evt-timeline",
    marketKey: "h2h:away"
  });

  assert.equal(timeline.points.length, 1);
  assert.equal(timeline.openTs, null);
});
