import { readMarketTimeline, type StoredTimelinePoint } from "@/lib/server/odds/historyStore";
import { listEvaluationResults, listValidationEvents } from "@/lib/server/odds/validationStore";
import { buildOutcomeMapForValidationEvents, computeOutcomeProfit } from "@/lib/server/odds/roiEvaluation";
import { buildOutcomeLookupKey } from "@/lib/server/odds/outcomes";
import { deriveMarketPressureSignal } from "@/lib/server/odds/movement";
import type { CloseReferenceMethod, MarketPressureSignal, PersistedEvaluationResult, PersistedValidationEvent } from "@/lib/server/odds/types";

export function detectMarketPressure(points: StoredTimelinePoint[]): MarketPressureSignal[] {
  const signal = deriveMarketPressureSignal({
    timeline: {
      version: 2,
      sportKey: "unknown",
      eventId: "unknown",
      marketKey: "unknown",
      points
    }
  });
  return signal.label === "none" ? [] : [signal];
}

export async function detectMarketPressureForMarket(params: {
  sportKey: string;
  eventId: string;
  marketKey: string;
}): Promise<MarketPressureSignal[]> {
  const timeline = await readMarketTimeline(params.sportKey, params.eventId, params.marketKey);
  return detectMarketPressure(timeline?.points || []);
}

export type MarketPressureRelationshipRow = {
  pressureBucket: "low" | "medium" | "high";
  samples: number;
  avgClvProbDelta: number | null;
  avgROI: number | null;
  likelyClosingRate: number | null;
};

export type MarketPressureRelationshipSummary = {
  sampleSize: number;
  pressureVsCLV: MarketPressureRelationshipRow[];
  pressureVsROI: MarketPressureRelationshipRow[];
  pressureVsTiming: MarketPressureRelationshipRow[];
};

type RelationshipAccumulator = {
  samples: number;
  clvValues: number[];
  roiValues: number[];
  likelyClosingCount: number;
};

function pressureBucket(score: number | null | undefined): "low" | "medium" | "high" {
  if (!Number.isFinite(score)) return "low";
  if ((score as number) >= 0.66) return "high";
  if ((score as number) >= 0.33) return "medium";
  return "low";
}

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function latestEvaluationByValidationId(evaluations: PersistedEvaluationResult[]): Map<string, PersistedEvaluationResult> {
  const byValidationId = new Map<string, PersistedEvaluationResult>();
  for (const evaluation of evaluations) {
    const existing = byValidationId.get(evaluation.validationEventId);
    if (!existing || existing.createdAt < evaluation.createdAt) {
      byValidationId.set(evaluation.validationEventId, evaluation);
    }
  }
  return byValidationId;
}

function clvByReference(evaluation: PersistedEvaluationResult | null, closeReference: CloseReferenceMethod): number | null {
  if (!evaluation) return null;
  if (closeReference === "closing_pinned_best") {
    return Number.isFinite(evaluation.clv.pinned.clvProbDelta) ? Number(evaluation.clv.pinned.clvProbDelta) : null;
  }
  if (closeReference === "closing_sharp_consensus") {
    return Number.isFinite(evaluation.clv.sharpConsensus.clvProbDelta)
      ? Number(evaluation.clv.sharpConsensus.clvProbDelta)
      : Number.isFinite(evaluation.clv.global.clvProbDelta)
        ? Number(evaluation.clv.global.clvProbDelta)
        : null;
  }
  if (closeReference === "closing_fair") {
    return Number.isFinite(evaluation.clv.fair.clvProbDelta)
      ? Number(evaluation.clv.fair.clvProbDelta)
      : Number.isFinite(evaluation.clv.global.clvProbDelta)
        ? Number(evaluation.clv.global.clvProbDelta)
        : null;
  }
  return Number.isFinite(evaluation.clv.global.clvProbDelta) ? Number(evaluation.clv.global.clvProbDelta) : null;
}

function isLikelyClosing(event: PersistedValidationEvent): boolean {
  return (event.diagnostics.reasons || []).some((reason) => reason.toLowerCase().includes("likely closing"));
}

function toRate(hits: number, total: number): number | null {
  if (total <= 0) return null;
  return hits / total;
}

function summarizeAccumulator(
  bucket: "low" | "medium" | "high",
  row: RelationshipAccumulator
): MarketPressureRelationshipRow {
  return {
    pressureBucket: bucket,
    samples: row.samples,
    avgClvProbDelta: avg(row.clvValues),
    avgROI: avg(row.roiValues),
    likelyClosingRate: toRate(row.likelyClosingCount, row.samples)
  };
}

export async function analyzePressureRelationships(
  limit = 500,
  options?: { closeReference?: CloseReferenceMethod }
): Promise<MarketPressureRelationshipSummary> {
  const [events, evaluations] = await Promise.all([listValidationEvents(limit), listEvaluationResults(limit)]);
  const outcomeMap = await buildOutcomeMapForValidationEvents(events);
  return analyzePressureRelationshipsFromData(events, evaluations, outcomeMap, options);
}

export function analyzePressureRelationshipsFromData(
  events: PersistedValidationEvent[],
  evaluations: PersistedEvaluationResult[],
  outcomeMap: Map<string, { result: "win" | "loss" | "push" | "void" | "unknown" }>,
  options?: { closeReference?: CloseReferenceMethod }
): MarketPressureRelationshipSummary {
  const closeReference = options?.closeReference || "closing_global_best";
  const byValidationId = latestEvaluationByValidationId(evaluations);
  const byBucket = new Map<"low" | "medium" | "high", RelationshipAccumulator>([
    ["low", { samples: 0, clvValues: [], roiValues: [], likelyClosingCount: 0 }],
    ["medium", { samples: 0, clvValues: [], roiValues: [], likelyClosingCount: 0 }],
    ["high", { samples: 0, clvValues: [], roiValues: [], likelyClosingCount: 0 }]
  ]);

  for (const event of events) {
    const bucket = pressureBucket(event.diagnostics.stalePenalty);
    const row = byBucket.get(bucket);
    if (!row) continue;
    row.samples += 1;

    if (isLikelyClosing(event)) {
      row.likelyClosingCount += 1;
    }

    const evaluation = byValidationId.get(event.id) || null;
    const clv = clvByReference(evaluation, closeReference);
    if (Number.isFinite(clv)) {
      row.clvValues.push(Number(clv));
    }

    const lookup = buildOutcomeLookupKey({
      sportKey: event.sportKey,
      eventId: event.eventId,
      marketKey: event.marketKey,
      sideKey: event.sideKey || "unknown"
    });
    const outcome = outcomeMap.get(lookup) || null;
    const profit = computeOutcomeProfit(outcome?.result || null, event.execution.displayedPriceAmerican ?? null);
    if (Number.isFinite(profit)) {
      row.roiValues.push(Number(profit));
    }
  }

  const rows: MarketPressureRelationshipRow[] = [
    summarizeAccumulator("low", byBucket.get("low") || { samples: 0, clvValues: [], roiValues: [], likelyClosingCount: 0 }),
    summarizeAccumulator("medium", byBucket.get("medium") || { samples: 0, clvValues: [], roiValues: [], likelyClosingCount: 0 }),
    summarizeAccumulator("high", byBucket.get("high") || { samples: 0, clvValues: [], roiValues: [], likelyClosingCount: 0 })
  ];

  return {
    sampleSize: events.length,
    pressureVsCLV: rows.map((row) => ({
      pressureBucket: row.pressureBucket,
      samples: row.samples,
      avgClvProbDelta: row.avgClvProbDelta,
      avgROI: null,
      likelyClosingRate: null
    })),
    pressureVsROI: rows.map((row) => ({
      pressureBucket: row.pressureBucket,
      samples: row.samples,
      avgClvProbDelta: null,
      avgROI: row.avgROI,
      likelyClosingRate: null
    })),
    pressureVsTiming: rows.map((row) => ({
      pressureBucket: row.pressureBucket,
      samples: row.samples,
      avgClvProbDelta: null,
      avgROI: null,
      likelyClosingRate: row.likelyClosingRate
    }))
  };
}
