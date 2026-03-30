import type { MarketKey } from "@/lib/odds/schemas";
import type { EvReliability, PersistedValidationEvent } from "@/lib/server/odds/types";
import { getPersistenceStatus } from "@/lib/server/odds/persistence";
import { persistValidationEvent } from "@/lib/server/odds/validationStore";

export type ValidationOpportunitySnapshot = {
  id?: string;
  type: "opportunity_snapshot";
  capturedAt: string;
  sportKey?: string;
  eventId: string;
  market: MarketKey;
  marketKey?: string;
  outcome: string;
  sideKey?: string;
  commenceTime: string;
  point?: number | null;
  score: number;
  edgePct: number;
  evPct?: number;
  fairPriceAmerican: number;
  fairProb?: number;
  confidenceLabel: string;
  confidenceScore: number;
  evDefensibility?: EvReliability;
  staleFlag: string;
  staleStrength: number;
  timingLabel: string;
  timingUrgency?: number;
  contributingBookCount: number;
  totalBookCount: number;
  sharpParticipationPct: number;
  pinnedBestBookKey: string | null;
  pinnedBestEdgePct: number;
  pinnedScore: number;
  bestBookKey: string;
  bestBookPriceAmerican: number;
  snapshotRef?: {
    key: string;
    bucketTs: number;
  } | null;
  historyRef?: {
    eventId: string;
    marketKey: string;
  } | null;
  diagnosticsReasons?: string[];
  factorBreakdown?: Record<string, number>;
};

export type ValidationEvent = ValidationOpportunitySnapshot;

export type ValidationEventSink = (event: ValidationEvent) => Promise<void> | void;

const MEMORY_LIMIT = 3000;
const memoryBuffer: ValidationEvent[] = [];
let customSink: ValidationEventSink | null = null;

export function setValidationEventSink(sink: ValidationEventSink | null): void {
  customSink = sink;
}

export function resetValidationEventsForTests(): void {
  memoryBuffer.length = 0;
  customSink = null;
}

export function getValidationEvents(limit = 200): ValidationEvent[] {
  const safeLimit = Math.max(1, Math.floor(limit));
  return memoryBuffer.slice(Math.max(0, memoryBuffer.length - safeLimit));
}

export function getValidationSinkMode(): "memory" | "custom" | "redis" {
  if (customSink) return "custom";
  const status = getPersistenceStatus();
  return status.durable ? "redis" : "memory";
}

function toPersistedEvent(event: ValidationEvent): PersistedValidationEvent {
  const createdAt = Number.isFinite(Date.parse(event.capturedAt)) ? Date.parse(event.capturedAt) : Date.now();
  const coverageRatio = event.totalBookCount > 0 ? event.contributingBookCount / event.totalBookCount : 0;

  return {
    version: 1,
    id: event.id || `${event.eventId}:${event.marketKey || event.market}:${createdAt}:${Math.round(event.score * 10)}`,
    createdAt,
    sportKey: event.sportKey || "unknown",
    eventId: event.eventId,
    marketKey: event.marketKey || event.market,
    sideKey: event.sideKey || event.outcome,
    commenceTime: event.commenceTime,
    point: event.point ?? null,
    bookKey: event.bestBookKey || null,
    snapshotRef: event.snapshotRef || null,
    historyRef: event.historyRef || null,
    pinnedContext: {
      pinnedBookKey: event.pinnedBestBookKey,
      pinnedBestPriceAmerican: null,
      globalBestPriceAmerican: event.bestBookPriceAmerican
    },
    model: {
      fairAmerican: event.fairPriceAmerican,
      fairProb: event.fairProb ?? null,
      rankingScore: event.score,
      confidenceScore: event.confidenceScore,
      evPct: event.evPct ?? event.edgePct,
      evDefensibility: event.evDefensibility ?? (event.market === "h2h" ? "full" : "qualified")
    },
    diagnostics: {
      stalePenalty: event.staleStrength,
      timingPenalty: Number.isFinite(event.timingUrgency) ? 1 - Number(event.timingUrgency) : null,
      coveragePenalty: 1 - coverageRatio,
      widthPenalty: null,
      reasons: event.diagnosticsReasons || [event.staleFlag, event.timingLabel],
      factorBreakdown: event.factorBreakdown || {}
    },
    execution: {
      displayedPriceAmerican: event.bestBookPriceAmerican,
      displayedBookKey: event.bestBookKey,
      displayedPoint: event.point ?? null
    }
  };
}

export async function trackValidationEvent(event: ValidationEvent): Promise<void> {
  memoryBuffer.push(event);
  if (memoryBuffer.length > MEMORY_LIMIT) {
    memoryBuffer.splice(0, memoryBuffer.length - MEMORY_LIMIT);
  }

  if (customSink) {
    try {
      await customSink(event);
    } catch {
      // Instrumentation should never break board generation.
    }
  }

  try {
    await persistValidationEvent(toPersistedEvent(event));
  } catch {
    // Persistence must never break board generation.
  }
}
