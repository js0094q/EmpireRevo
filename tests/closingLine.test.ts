import test from "node:test";
import assert from "node:assert/strict";
import type { StoredTimelinePoint } from "../lib/server/odds/historyStore";
import { selectClosingLine } from "../lib/server/odds/closingLine";

const points: StoredTimelinePoint[] = [
  {
    ts: 1_000,
    snapshotKey: "one",
    fairAmerican: -110,
    globalBestAmerican: -105,
    pinnedBestAmerican: -106,
    books: [
      { bookKey: "sharp-a", american: -107, isSharp: true, isPinned: false },
      { bookKey: "main-a", american: -105, isSharp: false, isPinned: true }
    ]
  },
  {
    ts: 2_000,
    snapshotKey: "two",
    fairAmerican: -112,
    globalBestAmerican: -104,
    pinnedBestAmerican: -108,
    books: [
      { bookKey: "sharp-a", american: -111, isSharp: true, isPinned: false },
      { bookKey: "sharp-b", american: -109, isSharp: true, isPinned: false },
      { bookKey: "main-a", american: -104, isSharp: false, isPinned: true }
    ]
  },
  {
    ts: 3_000,
    snapshotKey: "three",
    fairAmerican: -114,
    globalBestAmerican: -102,
    pinnedBestAmerican: -107,
    books: [
      { bookKey: "sharp-a", american: -113, isSharp: true, isPinned: false },
      { bookKey: "main-a", american: -102, isSharp: false, isPinned: true }
    ]
  }
];

test("closing line selection supports all configured methods", () => {
  const global = selectClosingLine({ points, method: "closing_global_best" });
  const pinned = selectClosingLine({ points, method: "closing_pinned_best" });
  const sharp = selectClosingLine({ points, method: "closing_sharp_consensus" });
  const fair = selectClosingLine({ points, method: "closing_fair" });

  assert.equal(global.american, -102);
  assert.equal(pinned.american, -107);
  assert.equal(sharp.american, -113);
  assert.equal(fair.american, -114);
});

test("closing line selection respects closeTs cutoffs", () => {
  const cutoff = selectClosingLine({
    points,
    method: "closing_global_best",
    closeTs: 2_400
  });

  assert.equal(cutoff.ts, 2_000);
  assert.equal(cutoff.american, -104);
});
