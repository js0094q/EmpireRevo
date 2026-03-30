import test from "node:test";
import assert from "node:assert/strict";
import type { StoredTimelinePoint } from "../lib/server/odds/historyStore";
import { detectMarketPressure } from "../lib/server/odds/marketPressure";

function point(ts: number, fair: number, globalBest: number, books: StoredTimelinePoint["books"]): StoredTimelinePoint {
  return {
    ts,
    snapshotKey: `s-${ts}`,
    fairAmerican: fair,
    globalBestAmerican: globalBest,
    pinnedBestAmerican: null,
    books
  };
}

test("market pressure emits sharp-led and lag signals only with evidence", () => {
  const baseTs = Date.now() - 40 * 60 * 1000;
  const points: StoredTimelinePoint[] = [
    point(baseTs, -110, -105, [
      { bookKey: "sharp-a", american: -110, isSharp: true, isPinned: false },
      { bookKey: "main-a", american: -105, isSharp: false, isPinned: false },
      { bookKey: "stale-a", american: -130, isSharp: false, isPinned: false }
    ]),
    point(baseTs + 10 * 60 * 1000, -116, -104, [
      { bookKey: "sharp-a", american: -116, isSharp: true, isPinned: false },
      { bookKey: "main-a", american: -105, isSharp: false, isPinned: false },
      { bookKey: "stale-a", american: -130, isSharp: false, isPinned: false }
    ]),
    point(baseTs + 35 * 60 * 1000, -118, -103, [
      { bookKey: "sharp-a", american: -118, isSharp: true, isPinned: false },
      { bookKey: "main-a", american: -103, isSharp: false, isPinned: false },
      { bookKey: "stale-a", american: -130, isSharp: false, isPinned: false }
    ])
  ];

  const signals = detectMarketPressure(points);
  const labels = signals.map((signal) => signal.label);

  assert.ok(labels.includes("fragmented"));
  assert.equal(signals[0]?.confidence, "low");
});

test("market pressure avoids sharp-led label when sequence evidence is missing", () => {
  const points: StoredTimelinePoint[] = [
    point(Date.now() - 2 * 60 * 1000, -110, -106, [
      { bookKey: "sharp-a", american: -110, isSharp: true, isPinned: false },
      { bookKey: "main-a", american: -106, isSharp: false, isPinned: false }
    ]),
    point(Date.now() - 60 * 1000, -109, -105, [
      { bookKey: "sharp-a", american: -109, isSharp: true, isPinned: false },
      { bookKey: "main-a", american: -105, isSharp: false, isPinned: false }
    ])
  ];

  const signals = detectMarketPressure(points);
  assert.equal(signals.some((signal) => signal.label === "sharp-up" || signal.label === "sharp-down"), false);
});
