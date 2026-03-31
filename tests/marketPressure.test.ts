import test from "node:test";
import assert from "node:assert/strict";
import type { StoredTimelinePoint } from "../lib/server/odds/historyStore";
import { analyzePressureRelationshipsFromData, detectMarketPressure } from "../lib/server/odds/marketPressure";
import type { PersistedValidationEvent } from "../lib/server/odds/types";

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

function validationEvent(id: string, marketPressureLabel: string | null, stalePenalty: number, reasons: string[]): PersistedValidationEvent {
  return {
    version: 1,
    id,
    createdAt: Date.now(),
    sportKey: "basketball_nba",
    eventId: `evt-${id}`,
    marketKey: "h2h",
    sideKey: "away",
    commenceTime: "2026-03-01T00:00:00.000Z",
    point: null,
    bookKey: "book-a",
    snapshotRef: null,
    pinnedContext: {
      pinnedBookKey: null,
      pinnedBestPriceAmerican: null,
      globalBestPriceAmerican: -104
    },
    model: {
      fairAmerican: -108,
      fairProb: 0.52,
      rankingScore: 65,
      confidenceScore: 0.66,
      evPct: 2.1,
      evDefensibility: "full"
    },
    diagnostics: {
      stalePenalty,
      marketPressureLabel,
      timingPenalty: 0.2,
      coveragePenalty: 0.1,
      widthPenalty: null,
      reasons,
      factorBreakdown: {}
    },
    execution: {
      displayedPriceAmerican: -104,
      displayedBookKey: "book-a",
      displayedPoint: null
    }
  };
}

test("pressure relationship buckets prefer explicit pressure labels over stale penalty", () => {
  const events = [
    validationEvent("high-by-label", "sharp-up", 0.1, []),
    validationEvent("low-by-label", "stale", 0.9, [])
  ];

  const summary = analyzePressureRelationshipsFromData(events, [], new Map());
  const highRow = summary.pressureVsCLV.find((row) => row.pressureBucket === "high");
  const lowRow = summary.pressureVsCLV.find((row) => row.pressureBucket === "low");

  assert.equal(highRow?.samples, 1);
  assert.equal(lowRow?.samples, 1);
});

test("pressure relationship buckets can infer from reasons when label is missing", () => {
  const events = [validationEvent("reason-derived", null, 0.05, ["Sharp books moved first"])];
  const summary = analyzePressureRelationshipsFromData(events, [], new Map());
  const highRow = summary.pressureVsCLV.find((row) => row.pressureBucket === "high");
  assert.equal(highRow?.samples, 1);
});
