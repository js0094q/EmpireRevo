import test from "node:test";
import assert from "node:assert/strict";
import { resetPersistenceForTests } from "../lib/server/odds/persistence";
import { getPersistenceTelemetrySnapshot, resetPersistenceTelemetryForTests } from "../lib/server/odds/persistenceTelemetry";
import type { PersistedMarketSnapshot, PersistedValidationEvent } from "../lib/server/odds/types";
import { writeMarketSnapshot } from "../lib/server/odds/historyStore";
import { persistValidationEvent } from "../lib/server/odds/validationStore";

function sampleSnapshot(ts: number): PersistedMarketSnapshot {
  return {
    version: 1,
    capturedAt: ts,
    sportKey: "basketball_nba",
    eventId: "evt-telemetry",
    marketKey: "h2h:away",
    marketType: "h2h",
    fair: {
      fairProb: 0.52,
      fairAmerican: -108
    },
    diagnostics: {
      rankingScore: 65,
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
        lastSeenAt: ts,
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

function sampleValidation(ts: number): PersistedValidationEvent {
  return {
    version: 1,
    id: "validation-telemetry",
    createdAt: ts,
    sportKey: "basketball_nba",
    eventId: "evt-telemetry",
    marketKey: "h2h:away",
    sideKey: "away",
    commenceTime: "2025-01-01T00:00:00.000Z",
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
      rankingScore: 70,
      confidenceScore: 0.72,
      evPct: 2,
      evDefensibility: "full"
    },
    diagnostics: {
      stalePenalty: 0.2,
      timingPenalty: 0.1,
      coveragePenalty: 0.1,
      widthPenalty: null,
      reasons: ["Sparse market coverage"],
      factorBreakdown: {
        edge: 0.2
      }
    },
    execution: {
      displayedPriceAmerican: -104,
      displayedBookKey: "book-a"
    }
  };
}

test.beforeEach(() => {
  resetPersistenceForTests();
  resetPersistenceTelemetryForTests();
});

test("persistence telemetry tracks writes, payload averages, and namespaces", async () => {
  const ts = Date.now();
  await writeMarketSnapshot(sampleSnapshot(ts));
  await persistValidationEvent(sampleValidation(ts));

  const telemetry = getPersistenceTelemetrySnapshot();
  assert.ok(telemetry.writesAttempted > 0);
  assert.ok(telemetry.writesSucceeded > 0);
  assert.ok(telemetry.avgSnapshotPayloadBytes > 0);
  assert.ok(telemetry.avgValidationPayloadBytes > 0);
  assert.ok(telemetry.namespacesTouched.some((namespace) => namespace.startsWith("empire:odds")));
  assert.ok(telemetry.namespacesTouched.some((namespace) => namespace.startsWith("empire:validation")));
});
