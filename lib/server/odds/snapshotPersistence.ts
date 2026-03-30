import type {
  FairEvent,
  FairOutcome,
  PersistedOddsSnapshot,
  PersistedSnapshotBucket
} from "@/lib/server/odds/types";
import { writeMarketSnapshot, type SnapshotRef } from "@/lib/server/odds/historyStore";
import { recordWriteFailure } from "@/lib/server/odds/persistenceTelemetry";

export function sanitizeMarketSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "unknown";
}

export function buildOutcomeMarketKey(eventMarket: string, outcomeName: string): string {
  const side = sanitizeMarketSegment(outcomeName);
  return `${sanitizeMarketSegment(eventMarket)}:${side}`;
}

export function canonicalHistoryEventId(event: Pick<FairEvent, "id" | "baseEventId">): string {
  return event.baseEventId || event.id;
}

export function snapshotLookupKey(eventId: string, marketKey: string): string {
  return `${eventId}|${marketKey}`;
}

function toSnapshotBucket(params: {
  sportKey: string;
  event: FairEvent;
  outcome: FairOutcome;
  capturedAt: number;
  marketKey: string;
}): PersistedSnapshotBucket {
  const rankingPenalties = params.outcome.rankingBreakdown?.penaltiesApplied || [];
  const coveragePenalty = rankingPenalties
    .filter((entry) => entry.reason.toLowerCase().includes("coverage"))
    .reduce((sum, entry) => sum + Math.abs(entry.delta), 0);
  const historyEventId = canonicalHistoryEventId(params.event);
  const observedAt = new Date(params.capturedAt).toISOString();

  const snapshots: PersistedOddsSnapshot[] = params.outcome.books.map((book) => ({
    version: 1,
    sportKey: params.sportKey,
    eventId: historyEventId,
    marketKey: params.marketKey,
    marketType: params.event.market,
    outcomeKey: sanitizeMarketSegment(params.outcome.name),
    outcomeLabel: params.outcome.name,
    bookmakerKey: book.bookKey,
    bookmakerTitle: book.title,
    bookmakerTier: book.tier,
    isPinned: params.outcome.pinnedActionability.bestPinnedBookKey === book.bookKey,
    isSharp: book.isSharpBook,
    isBestPrice: book.isBestPrice,
    priceAmerican: book.priceAmerican ?? null,
    point: book.point ?? params.event.linePoint ?? null,
    impliedProbability: book.impliedProb,
    noVigProbability: book.impliedProbNoVig,
    fairProbability: params.outcome.fairProb,
    fairAmerican: params.outcome.fairAmerican,
    rankingScore: params.outcome.opportunityScore,
    confidenceScore: params.outcome.confidenceScore,
    staleStrength: params.outcome.staleStrength,
    timingUrgency: params.outcome.timingSignal.urgencyScore,
    edgePct: book.edgePct,
    evPct: book.evPct,
    observedAt,
    bookLastSeenAt: book.lastUpdate || observedAt
  }));

  return {
    version: 1,
    capturedAt: params.capturedAt,
    observedAt,
    sportKey: params.sportKey,
    eventId: historyEventId,
    marketKey: params.marketKey,
    marketType: params.event.market,
    fair: {
      fairProb: params.outcome.fairProb,
      fairAmerican: params.outcome.fairAmerican
    },
    diagnostics: {
      rankingScore: params.outcome.opportunityScore,
      confidenceScore: params.outcome.confidenceScore,
      stalePenalty: params.outcome.staleStrength,
      timingPenalty: 1 - params.outcome.timingSignal.urgencyScore,
      coveragePenalty,
      evDefensibility: params.outcome.evReliability,
      penaltyReasons: rankingPenalties.map((entry) => entry.reason),
      factorBreakdown: params.outcome.rankingBreakdown?.componentContributions
    },
    snapshots
  };
}

export type PersistBoardSnapshotResult = {
  refs: Map<string, SnapshotRef>;
  written: number;
  failures: number;
};

export async function persistBoardSnapshots(params: {
  sportKey: string;
  events: FairEvent[];
  capturedAt?: number;
}): Promise<PersistBoardSnapshotResult> {
  const capturedAt = params.capturedAt ?? Date.now();
  const refs = new Map<string, SnapshotRef>();
  let written = 0;
  let failures = 0;

  await Promise.all(
    params.events.flatMap((event) =>
      event.outcomes.map(async (outcome) => {
        const marketKey = buildOutcomeMarketKey(event.market, outcome.name);
        const bucket = toSnapshotBucket({
          sportKey: params.sportKey,
          event,
          outcome,
          capturedAt,
          marketKey
        });
        try {
          const ref = await writeMarketSnapshot(bucket);
          refs.set(snapshotLookupKey(bucket.eventId, marketKey), ref);
          written += bucket.snapshots.length;
        } catch {
          failures += 1;
          recordWriteFailure("empire:odds:snapshot");
          console.error("[snapshotPersistence] failed to persist snapshot bucket", {
            eventId: bucket.eventId,
            marketKey
          });
        }
      })
    )
  );

  return {
    refs,
    written,
    failures
  };
}
