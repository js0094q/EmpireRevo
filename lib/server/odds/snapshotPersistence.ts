import type { FairEvent, FairOutcome, PersistedMarketSnapshot } from "@/lib/server/odds/types";
import { writeMarketSnapshot, type SnapshotRef } from "@/lib/server/odds/historyStore";
import { recordWriteFailure } from "@/lib/server/odds/persistenceTelemetry";

export function sanitizeMarketSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "unknown";
}

export function buildOutcomeMarketKey(eventMarket: string, outcomeName: string, point?: number | null): string {
  const side = sanitizeMarketSegment(outcomeName);
  const pointKey = Number.isFinite(point) ? `:${Number(point)}` : "";
  return `${sanitizeMarketSegment(eventMarket)}:${side}${pointKey}`;
}

export function snapshotLookupKey(eventId: string, marketKey: string): string {
  return `${eventId}|${marketKey}`;
}

function toSnapshot(params: {
  sportKey: string;
  event: FairEvent;
  outcome: FairOutcome;
  capturedAt: number;
  marketKey: string;
}): PersistedMarketSnapshot {
  const rankingPenalties = params.outcome.rankingBreakdown?.penaltiesApplied || [];
  const coveragePenalty = rankingPenalties
    .filter((entry) => entry.reason.toLowerCase().includes("coverage"))
    .reduce((sum, entry) => sum + Math.abs(entry.delta), 0);

  return {
    version: 1,
    capturedAt: params.capturedAt,
    sportKey: params.sportKey,
    eventId: params.event.id,
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
    books: params.outcome.books.map((book) => ({
      bookKey: book.bookKey,
      bookTitle: book.title,
      bookTier: book.tier,
      isPinned: params.outcome.pinnedActionability.bestPinnedBookKey === book.bookKey,
      isSharp: book.isSharpBook,
      isBestPrice: book.isBestPrice,
      lastSeenAt: Number.isFinite(Date.parse(book.lastUpdate || "")) ? Date.parse(book.lastUpdate as string) : params.capturedAt,
      outcomes: [
        {
          name: params.outcome.name,
          point: book.point ?? null,
          priceAmerican: book.priceAmerican,
          impliedProb: book.impliedProb,
          noVigProb: book.impliedProbNoVig
        }
      ]
    }))
  };
}

export async function persistBoardSnapshots(params: {
  sportKey: string;
  events: FairEvent[];
  capturedAt?: number;
}): Promise<Map<string, SnapshotRef>> {
  const capturedAt = params.capturedAt ?? Date.now();
  const refs = new Map<string, SnapshotRef>();

  await Promise.all(
    params.events.flatMap((event) =>
      event.outcomes.map(async (outcome) => {
        const point = outcome.books[0]?.point ?? event.linePoint;
        const marketKey = buildOutcomeMarketKey(event.market, outcome.name, point);
        const snapshot = toSnapshot({
          sportKey: params.sportKey,
          event,
          outcome,
          capturedAt,
          marketKey
        });
        try {
          const ref = await writeMarketSnapshot(snapshot);
          refs.set(snapshotLookupKey(event.id, marketKey), ref);
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown";
          recordWriteFailure("empire:odds:snapshot");
          console.error("[snapshotPersistence] failed to persist snapshot", {
            eventId: event.id,
            marketKey,
            message
          });
        }
      })
    )
  );

  return refs;
}
