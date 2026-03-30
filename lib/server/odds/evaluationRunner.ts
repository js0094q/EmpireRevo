import {
  DEFAULT_CLOSE_REFERENCE,
  describeCloseReference,
  resolveClosingLines,
  type ClosingLineMethod
} from "@/lib/server/odds/closingLine";
import { computeClv } from "@/lib/server/odds/clv";
import {
  listEvaluationResults,
  listValidationEvents,
  persistEvaluationResult
} from "@/lib/server/odds/validationStore";
import { summarizeRoiForValidationEvents, type RoiSummary } from "@/lib/server/odds/roiEvaluation";
import type {
  CloseReferenceMethod,
  ClvResult,
  EvaluationMethodology,
  PersistedEvaluationResult,
  PersistedValidationEvent
} from "@/lib/server/odds/types";

export type EvaluationSummary = {
  sampleSize: number;
  closeReference: CloseReferenceMethod;
  closeReferenceDescription: string;
  isDefaultCloseReference: boolean;
  evaluationMethodology: EvaluationMethodology;
  beatCloseRate: number | null;
  averageClvProbDelta: number | null;
  averageDisplayAmericanDelta: number | null;
  // Deprecated compatibility field. Prefer averageDisplayAmericanDelta.
  averageClvDelta: number | null;
  rankingDeciles: Array<{ decile: number; samples: number; beatCloseRate: number | null }>;
  confidenceBuckets: Array<{ bucket: "low" | "medium" | "high"; samples: number; beatCloseRate: number | null }>;
  evDefensibility: Array<{ class: string; samples: number; beatCloseRate: number | null }>;
  pinnedVsGlobal: {
    samples: number;
    globalBeatRate: number | null;
    pinnedBeatRate: number | null;
  };
  roiSummary: RoiSummary;
};

function confidenceBucket(score: number | null | undefined): "low" | "medium" | "high" {
  if (!Number.isFinite(score)) return "low";
  if ((score as number) >= 0.75) return "high";
  if ((score as number) >= 0.55) return "medium";
  return "low";
}

function rankingDecile(score: number | null | undefined): number {
  if (!Number.isFinite(score)) return 1;
  const normalized = Math.max(0, Math.min(100, Number(score)));
  return Math.min(10, Math.max(1, Math.ceil(normalized / 10)));
}

function toRate(hits: number, total: number): number | null {
  if (total <= 0) return null;
  return hits / total;
}

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function finiteOrNull(value: number | null | undefined): number | null {
  return Number.isFinite(value) ? Number(value) : null;
}

function preferNumber(cached: number | null | undefined, recomputed: number | null | undefined): number | null {
  const cachedValue = finiteOrNull(cached);
  if (cachedValue !== null) return cachedValue;
  return finiteOrNull(recomputed);
}

function preferBoolean(
  cached: boolean | null | undefined,
  recomputed: boolean | null | undefined
): boolean | null {
  if (cached === true || cached === false) return cached;
  if (recomputed === true || recomputed === false) return recomputed;
  return null;
}

function mergeClvResult(cached: ClvResult, recomputed: ClvResult): ClvResult {
  return {
    betPriceAmerican: preferNumber(cached.betPriceAmerican, recomputed.betPriceAmerican),
    closePriceAmerican: preferNumber(cached.closePriceAmerican, recomputed.closePriceAmerican),
    fairAtBetTime: preferNumber(cached.fairAtBetTime, recomputed.fairAtBetTime),
    betImpliedProb: preferNumber(cached.betImpliedProb, recomputed.betImpliedProb),
    closeImpliedProb: preferNumber(cached.closeImpliedProb, recomputed.closeImpliedProb),
    clvProbDelta: preferNumber(cached.clvProbDelta, recomputed.clvProbDelta),
    beatClose: preferBoolean(cached.beatClose, recomputed.beatClose),
    displayAmericanDelta: preferNumber(cached.displayAmericanDelta, recomputed.displayAmericanDelta),
    clvAmericanDelta: preferNumber(cached.clvAmericanDelta, recomputed.clvAmericanDelta),
    closeReference: cached.closeReference || recomputed.closeReference
  };
}

function mergeEvaluationRecord(
  cached: PersistedEvaluationResult,
  recomputed: PersistedEvaluationResult
): PersistedEvaluationResult {
  const recomputedRecommendation = recomputed.recommendation || {
    capturedAt: recomputed.createdAt,
    priceAmerican: null,
    point: null,
    impliedProbability: null,
    fairAmerican: null,
    fairProbability: null
  };
  return {
    ...recomputed,
    ...cached,
    createdAt: Math.max(recomputed.createdAt, cached.createdAt),
    close: {
      globalBestAmerican: preferNumber(cached.close.globalBestAmerican, recomputed.close.globalBestAmerican),
      globalBestPoint: preferNumber(cached.close.globalBestPoint, recomputed.close.globalBestPoint),
      pinnedBestAmerican: preferNumber(cached.close.pinnedBestAmerican, recomputed.close.pinnedBestAmerican),
      pinnedBestPoint: preferNumber(cached.close.pinnedBestPoint, recomputed.close.pinnedBestPoint),
      sharpConsensusAmerican: preferNumber(cached.close.sharpConsensusAmerican, recomputed.close.sharpConsensusAmerican),
      sharpConsensusPoint: preferNumber(cached.close.sharpConsensusPoint, recomputed.close.sharpConsensusPoint),
      fairAmerican: preferNumber(cached.close.fairAmerican, recomputed.close.fairAmerican),
      fairPoint: preferNumber(cached.close.fairPoint, recomputed.close.fairPoint)
    },
    clv: {
      global: mergeClvResult(cached.clv.global, recomputed.clv.global),
      pinned: mergeClvResult(cached.clv.pinned, recomputed.clv.pinned),
      sharpConsensus: mergeClvResult(cached.clv.sharpConsensus, recomputed.clv.sharpConsensus),
      fair: mergeClvResult(cached.clv.fair, recomputed.clv.fair)
    },
    beatCloseGlobal: preferBoolean(cached.beatCloseGlobal, recomputed.beatCloseGlobal),
    beatClosePinned: preferBoolean(cached.beatClosePinned, recomputed.beatClosePinned),
    modelEdgeHeld: preferBoolean(cached.modelEdgeHeld, recomputed.modelEdgeHeld),
    evDefensibility: cached.evDefensibility ?? recomputed.evDefensibility,
    methodology: cached.methodology || recomputed.methodology,
    historyRef: cached.historyRef || recomputed.historyRef,
    recommendation: {
      capturedAt: Math.max(cached.recommendation?.capturedAt || 0, recomputedRecommendation.capturedAt),
      priceAmerican: preferNumber(cached.recommendation?.priceAmerican, recomputedRecommendation.priceAmerican),
      point: preferNumber(cached.recommendation?.point, recomputedRecommendation.point),
      impliedProbability: preferNumber(
        cached.recommendation?.impliedProbability,
        recomputedRecommendation.impliedProbability
      ),
      fairAmerican: preferNumber(cached.recommendation?.fairAmerican, recomputedRecommendation.fairAmerican),
      fairProbability: preferNumber(cached.recommendation?.fairProbability, recomputedRecommendation.fairProbability)
    }
  };
}

function latestByValidation(
  results: PersistedEvaluationResult[]
): PersistedEvaluationResult[] {
  const byValidationId = new Map<string, PersistedEvaluationResult>();
  for (const result of results) {
    const key = result.validationEventId;
    const existing = byValidationId.get(key);
    if (!existing || existing.createdAt < result.createdAt) {
      byValidationId.set(key, result);
    }
  }
  return Array.from(byValidationId.values()).sort((a, b) => b.createdAt - a.createdAt);
}

function mergeEvaluationSets(
  cached: PersistedEvaluationResult[],
  recomputed: PersistedEvaluationResult[]
): PersistedEvaluationResult[] {
  const merged = new Map<string, PersistedEvaluationResult>();

  for (const result of recomputed) {
    merged.set(result.validationEventId, result);
  }

  for (const result of cached) {
    const existing = merged.get(result.validationEventId);
    if (!existing) {
      merged.set(result.validationEventId, result);
      continue;
    }
    merged.set(result.validationEventId, mergeEvaluationRecord(result, existing));
  }

  return Array.from(merged.values()).sort((a, b) => b.createdAt - a.createdAt);
}

function methodology(closeReference: CloseReferenceMethod): EvaluationMethodology {
  return {
    closeReference,
    clvSpace: "implied_probability",
    displaySpace: "american_odds",
    roiStakeModel: "flat_unit_stake",
    probabilitySource: "validation_event_fair_probability",
    isDefaultCloseReference: closeReference === DEFAULT_CLOSE_REFERENCE
  };
}

function clvForReference(result: PersistedEvaluationResult, closeReference: CloseReferenceMethod): ClvResult {
  if (closeReference === "closing_global_best") return result.clv.global;
  if (closeReference === "closing_pinned_best") return result.clv.pinned;
  if (closeReference === "closing_sharp_consensus") return result.clv.sharpConsensus || result.clv.global;
  return result.clv.fair || result.clv.global;
}

function normalizeCloseReference(closeReference?: CloseReferenceMethod): CloseReferenceMethod {
  if (
    closeReference === "closing_global_best" ||
    closeReference === "closing_pinned_best" ||
    closeReference === "closing_sharp_consensus" ||
    closeReference === "closing_fair"
  ) {
    return closeReference;
  }
  return DEFAULT_CLOSE_REFERENCE;
}

export async function evaluateValidationEvent(
  event: PersistedValidationEvent,
  nowMs = Date.now()
): Promise<PersistedEvaluationResult | null> {
  const commenceMs = event.commenceTime ? Date.parse(event.commenceTime) : Number.NaN;
  if (Number.isFinite(commenceMs) && nowMs < commenceMs) {
    return null;
  }

  const closeTs = Number.isFinite(commenceMs) ? commenceMs : undefined;
  const historyEventId = event.historyRef?.eventId || event.eventId;
  const historyMarketKey = event.historyRef?.marketKey || event.marketKey;
  const close = await resolveClosingLines({
    sportKey: event.sportKey,
    eventId: historyEventId,
    marketKey: historyMarketKey,
    closeTs
  });

  const displayedPrice = event.execution.displayedPriceAmerican ?? null;
  const global = computeClv({
    betPriceAmerican: displayedPrice,
    closePriceAmerican: close.closing_global_best.american,
    fairAtBetTime: event.model.fairAmerican ?? null,
    closeReference: "closing_global_best"
  });
  const pinned = computeClv({
    betPriceAmerican: displayedPrice,
    closePriceAmerican: close.closing_pinned_best.american,
    fairAtBetTime: event.model.fairAmerican ?? null,
    closeReference: "closing_pinned_best"
  });
  const sharpConsensus = computeClv({
    betPriceAmerican: displayedPrice,
    closePriceAmerican: close.closing_sharp_consensus.american,
    fairAtBetTime: event.model.fairAmerican ?? null,
    closeReference: "closing_sharp_consensus"
  });
  const fairClose = computeClv({
    betPriceAmerican: displayedPrice,
    closePriceAmerican: close.closing_fair.american,
    fairAtBetTime: event.model.fairAmerican ?? null,
    closeReference: "closing_fair"
  });

  const modelEdgeHeld = Number.isFinite(event.model.fairAmerican) && Number.isFinite(close.closing_fair.american)
    ? Number(displayedPrice) - Number(close.closing_fair.american) >= 0
    : null;

  const result: PersistedEvaluationResult = {
    version: 1,
    id: `${event.id}:eval`,
    validationEventId: event.id,
    createdAt: nowMs,
    sportKey: event.sportKey,
    eventId: event.eventId,
    marketKey: event.marketKey,
    historyRef: event.historyRef || null,
    recommendation: {
      capturedAt: event.createdAt,
      priceAmerican: displayedPrice,
      point: event.execution.displayedPoint ?? event.point ?? null,
      impliedProbability: global.betImpliedProb ?? null,
      fairAmerican: event.model.fairAmerican ?? null,
      fairProbability: event.model.fairProb ?? null
    },
    close: {
      globalBestAmerican: close.closing_global_best.american,
      globalBestPoint: close.closing_global_best.point,
      pinnedBestAmerican: close.closing_pinned_best.american,
      pinnedBestPoint: close.closing_pinned_best.point,
      sharpConsensusAmerican: close.closing_sharp_consensus.american,
      sharpConsensusPoint: close.closing_sharp_consensus.point,
      fairAmerican: close.closing_fair.american,
      fairPoint: close.closing_fair.point
    },
    clv: {
      global,
      pinned,
      sharpConsensus,
      fair: fairClose
    },
    beatCloseGlobal: global.beatClose,
    beatClosePinned: pinned.beatClose,
    modelEdgeHeld,
    confidenceBucket: confidenceBucket(event.model.confidenceScore),
    rankingDecile: rankingDecile(event.model.rankingScore),
    evDefensibility: event.model.evDefensibility ?? null,
    methodology: methodology(DEFAULT_CLOSE_REFERENCE)
  };

  await persistEvaluationResult(result);
  return result;
}

export async function evaluateRecentValidationEvents(limit = 200): Promise<PersistedEvaluationResult[]> {
  const events = await listValidationEvents(limit);
  const evaluated = await Promise.all(events.map((event) => evaluateValidationEvent(event)));
  return evaluated.filter((entry): entry is PersistedEvaluationResult => Boolean(entry));
}

export function summarizeEvaluationResults(
  results: PersistedEvaluationResult[],
  options?: { closeReference?: CloseReferenceMethod; roiSummary?: RoiSummary }
): EvaluationSummary {
  const closeReference = normalizeCloseReference(options?.closeReference);

  const deltas = results
    .map((result) => clvForReference(result, closeReference).clvProbDelta)
    .filter((value): value is number => Number.isFinite(value));

  const displayDeltas = results
    .map((result) => clvForReference(result, closeReference).displayAmericanDelta)
    .filter((value): value is number => Number.isFinite(value));

  const hits = results.filter((result) => clvForReference(result, closeReference).beatClose === true).length;

  const deciles = Array.from({ length: 10 }, (_, idx) => idx + 1).map((decile) => {
    const subset = results.filter((result) => result.rankingDecile === decile);
    return {
      decile,
      samples: subset.length,
      beatCloseRate: toRate(
        subset.filter((result) => clvForReference(result, closeReference).beatClose === true).length,
        subset.length
      )
    };
  });

  const confidenceBuckets: Array<"low" | "medium" | "high"> = ["low", "medium", "high"];
  const confidence = confidenceBuckets.map((bucket) => {
    const subset = results.filter((result) => result.confidenceBucket === bucket);
    return {
      bucket,
      samples: subset.length,
      beatCloseRate: toRate(
        subset.filter((result) => clvForReference(result, closeReference).beatClose === true).length,
        subset.length
      )
    };
  });

  const defensibilityValues = Array.from(new Set(results.map((result) => result.evDefensibility || "unknown")));
  const evDefensibility = defensibilityValues.map((klass) => {
    const subset = results.filter((result) => (result.evDefensibility || "unknown") === klass);
    return {
      class: klass,
      samples: subset.length,
      beatCloseRate: toRate(
        subset.filter((result) => clvForReference(result, closeReference).beatClose === true).length,
        subset.length
      )
    };
  });

  const pinnedSubset = results.filter((result) => result.beatClosePinned !== null);

  return {
    sampleSize: results.length,
    closeReference,
    closeReferenceDescription: describeCloseReference(closeReference),
    isDefaultCloseReference: closeReference === DEFAULT_CLOSE_REFERENCE,
    evaluationMethodology: methodology(closeReference),
    beatCloseRate: toRate(hits, results.length),
    averageClvProbDelta: avg(deltas),
    averageDisplayAmericanDelta: avg(displayDeltas),
    averageClvDelta: avg(displayDeltas),
    rankingDeciles: deciles,
    confidenceBuckets: confidence,
    evDefensibility,
    pinnedVsGlobal: {
      samples: pinnedSubset.length,
      globalBeatRate: toRate(
        pinnedSubset.filter((result) => result.beatCloseGlobal === true).length,
        pinnedSubset.length
      ),
      pinnedBeatRate: toRate(
        pinnedSubset.filter((result) => result.beatClosePinned === true).length,
        pinnedSubset.length
      )
    },
    roiSummary: options?.roiSummary || {
      sampleSize: 0,
      settledSampleSize: 0,
      confidenceTier: "low",
      roi: null,
      unitsWon: null,
      winRate: null,
      averageEdge: null,
      outcomes: {
        win: 0,
        loss: 0,
        push: 0,
        void: 0,
        unknown: 0
      }
    }
  };
}

export async function getEvaluationSummary(
  limit = 200,
  options?: { closeReference?: CloseReferenceMethod }
): Promise<EvaluationSummary> {
  const closeReference = normalizeCloseReference(options?.closeReference);
  const [events, cachedRaw] = await Promise.all([listValidationEvents(limit), listEvaluationResults(limit)]);
  const cached = latestByValidation(cachedRaw);

  let evaluations: PersistedEvaluationResult[];
  if (!cached.length) {
    evaluations = (await Promise.all(events.map((event) => evaluateValidationEvent(event))))
      .filter((entry): entry is PersistedEvaluationResult => Boolean(entry));
  } else {
    const cachedIds = new Set(cached.map((result) => result.validationEventId));
    const missingEvents = events.filter((event) => !cachedIds.has(event.id));
    const recomputedMissing = (await Promise.all(missingEvents.map((event) => evaluateValidationEvent(event))))
      .filter((entry): entry is PersistedEvaluationResult => Boolean(entry));
    evaluations = mergeEvaluationSets(cached, recomputedMissing);
  }

  const roiSummary = await summarizeRoiForValidationEvents(events);
  return summarizeEvaluationResults(evaluations.slice(0, limit), { closeReference, roiSummary });
}

export function parseCloseReference(value: string | null | undefined): CloseReferenceMethod {
  const method = normalizeCloseReference(value as CloseReferenceMethod | undefined);
  return method;
}

export const DEFAULT_EVALUATION_CLOSE_REFERENCE: ClosingLineMethod = DEFAULT_CLOSE_REFERENCE;
