import { analyzeProbabilityCalibration, buildCalibrationSamplesFromData, type ProbabilityCalibrationSummary } from "@/lib/server/odds/calibrationAnalysis";
import { buildFactorPerformanceFromData, type FactorPerformanceSummary } from "@/lib/server/odds/factorPerformance";
import { analyzePressureRelationshipsFromData, type MarketPressureRelationshipSummary } from "@/lib/server/odds/marketPressure";
import { buildOutcomeMapForValidationEvents, buildRoiRowsFromData, summarizeRoiRows, type RoiSummary } from "@/lib/server/odds/roiEvaluation";
import { summarizeEvaluationResults } from "@/lib/server/odds/evaluationRunner";
import { buildOutcomeLookupKey } from "@/lib/server/odds/outcomes";
import { confidenceTierForSampleSize } from "@/lib/server/odds/sampleConfidence";
import { listEvaluationResults, listValidationEvents } from "@/lib/server/odds/validationStore";
import type { CloseReferenceMethod, EvaluationMethodology, PersistedEvaluationResult, PersistedOutcomeResult, PersistedValidationEvent, SampleConfidenceTier } from "@/lib/server/odds/types";

export type ConfidenceInterval = {
  low: number;
  high: number;
  level: 0.95;
  method: "wilson" | "normal";
};

export type EvaluationReportWindow = {
  window: "daily" | "weekly" | "rolling30d" | "rolling90d";
  fromTs: number;
  toTs: number;
  sampleSize: number;
  settledSampleSize: number;
  confidenceTier: SampleConfidenceTier;
  clvPerformance: {
    sampleSize: number;
    beatCloseRate: number | null;
    averageClvProbDelta: number | null;
    confidenceIntervals: {
      beatCloseRate: ConfidenceInterval | null;
      averageClvProbDelta: ConfidenceInterval | null;
    };
  };
  roiPerformance: RoiSummary & {
    confidenceIntervals: {
      roi: ConfidenceInterval | null;
      winRate: ConfidenceInterval | null;
    };
  };
  probabilityCalibration: ProbabilityCalibrationSummary;
  factorPerformance: FactorPerformanceSummary;
  pressureSignalAnalysis: MarketPressureRelationshipSummary;
};

export type EvaluationReportBundle = {
  generatedAt: number;
  evaluationMethodology: EvaluationMethodology;
  windows: EvaluationReportWindow[];
};

function pickClvDelta(result: PersistedEvaluationResult, closeReference: CloseReferenceMethod): number | null {
  if (closeReference === "closing_pinned_best") {
    return Number.isFinite(result.clv.pinned.clvProbDelta) ? Number(result.clv.pinned.clvProbDelta) : null;
  }
  if (closeReference === "closing_sharp_consensus") {
    return Number.isFinite(result.clv.sharpConsensus.clvProbDelta)
      ? Number(result.clv.sharpConsensus.clvProbDelta)
      : Number.isFinite(result.clv.global.clvProbDelta)
        ? Number(result.clv.global.clvProbDelta)
        : null;
  }
  if (closeReference === "closing_fair") {
    return Number.isFinite(result.clv.fair.clvProbDelta)
      ? Number(result.clv.fair.clvProbDelta)
      : Number.isFinite(result.clv.global.clvProbDelta)
        ? Number(result.clv.global.clvProbDelta)
        : null;
  }
  return Number.isFinite(result.clv.global.clvProbDelta) ? Number(result.clv.global.clvProbDelta) : null;
}

function pickBeatClose(result: PersistedEvaluationResult, closeReference: CloseReferenceMethod): boolean | null {
  if (closeReference === "closing_pinned_best") return result.clv.pinned.beatClose ?? null;
  if (closeReference === "closing_sharp_consensus") {
    if (result.clv.sharpConsensus.beatClose === true || result.clv.sharpConsensus.beatClose === false) {
      return result.clv.sharpConsensus.beatClose;
    }
    return result.clv.global.beatClose ?? null;
  }
  if (closeReference === "closing_fair") {
    if (result.clv.fair.beatClose === true || result.clv.fair.beatClose === false) {
      return result.clv.fair.beatClose;
    }
    return result.clv.global.beatClose ?? null;
  }
  return result.clv.global.beatClose ?? null;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalCi(values: number[]): ConfidenceInterval | null {
  if (values.length < 2) return null;
  const m = mean(values);
  if (!Number.isFinite(m)) return null;

  const variance = values.reduce((sum, value) => sum + (value - Number(m)) ** 2, 0) / (values.length - 1);
  const stdDev = Math.sqrt(variance);
  const se = stdDev / Math.sqrt(values.length);
  const z = 1.96;

  return {
    low: Number(m) - z * se,
    high: Number(m) + z * se,
    level: 0.95,
    method: "normal"
  };
}

function wilsonCi(successes: number, total: number): ConfidenceInterval | null {
  if (total <= 0) return null;
  const z = 1.96;
  const p = successes / total;
  const denominator = 1 + (z ** 2) / total;
  const center = (p + (z ** 2) / (2 * total)) / denominator;
  const margin =
    (z / denominator) *
    Math.sqrt((p * (1 - p)) / total + (z ** 2) / (4 * total ** 2));

  return {
    low: Math.max(0, center - margin),
    high: Math.min(1, center + margin),
    level: 0.95,
    method: "wilson"
  };
}

function makeWindow(now: number): Array<{ key: "daily" | "weekly" | "rolling30d" | "rolling90d"; fromTs: number; toTs: number }> {
  const day = 24 * 60 * 60 * 1000;
  return [
    { key: "daily", fromTs: now - day, toTs: now },
    { key: "weekly", fromTs: now - 7 * day, toTs: now },
    { key: "rolling30d", fromTs: now - 30 * day, toTs: now },
    { key: "rolling90d", fromTs: now - 90 * day, toTs: now }
  ];
}

function filterByWindow(
  events: PersistedValidationEvent[],
  evaluations: PersistedEvaluationResult[],
  fromTs: number,
  toTs: number
): {
  events: PersistedValidationEvent[];
  evaluations: PersistedEvaluationResult[];
} {
  const filteredEvents = events.filter((event) => event.createdAt >= fromTs && event.createdAt <= toTs);
  const ids = new Set(filteredEvents.map((event) => event.id));
  const filteredEvaluations = evaluations.filter((evaluation) => ids.has(evaluation.validationEventId));
  return {
    events: filteredEvents,
    evaluations: filteredEvaluations
  };
}

function method(closeReference: CloseReferenceMethod): EvaluationMethodology {
  return {
    closeReference,
    clvSpace: "implied_probability",
    displaySpace: "american_odds",
    roiStakeModel: "flat_unit_stake",
    probabilitySource: "validation_event_fair_probability",
    isDefaultCloseReference: closeReference === "closing_global_best"
  };
}

function toOutcomeMap(
  source: Map<string, PersistedOutcomeResult>,
  events: PersistedValidationEvent[]
): Map<string, PersistedOutcomeResult> {
  const subset = new Map<string, PersistedOutcomeResult>();
  for (const event of events) {
    const lookup = buildOutcomeLookupKey({
      sportKey: event.sportKey,
      eventId: event.eventId,
      marketKey: event.marketKey,
      sideKey: event.sideKey || "unknown"
    });
    const row = source.get(lookup);
    if (row) subset.set(lookup, row);
  }
  return subset;
}

function clvConfidenceIntervals(
  evaluations: PersistedEvaluationResult[],
  closeReference: CloseReferenceMethod
): {
  beatCloseRate: ConfidenceInterval | null;
  averageClvProbDelta: ConfidenceInterval | null;
} {
  const deltas = evaluations
    .map((row) => pickClvDelta(row, closeReference))
    .filter((value): value is number => Number.isFinite(value));

  const beatRows = evaluations
    .map((row) => pickBeatClose(row, closeReference))
    .filter((value): value is boolean => value === true || value === false);

  const beatHits = beatRows.filter(Boolean).length;
  return {
    beatCloseRate: wilsonCi(beatHits, beatRows.length),
    averageClvProbDelta: normalCi(deltas)
  };
}

function roiConfidenceIntervals(roiSummary: RoiSummary): {
  roi: ConfidenceInterval | null;
  winRate: ConfidenceInterval | null;
} {
  const decisions = roiSummary.outcomes.win + roiSummary.outcomes.loss;
  return {
    roi: null,
    winRate: wilsonCi(roiSummary.outcomes.win, decisions)
  };
}

function confidenceIntervalWidth(interval: ConfidenceInterval | null): number | null {
  if (!interval) return null;
  if (!Number.isFinite(interval.low) || !Number.isFinite(interval.high)) return null;
  return Math.max(0, interval.high - interval.low);
}

export async function buildEvaluationReports(
  limit = 1000,
  options?: { closeReference?: CloseReferenceMethod; nowMs?: number }
): Promise<EvaluationReportBundle> {
  const closeReference = options?.closeReference || "closing_global_best";
  const now = Number.isFinite(options?.nowMs) ? Number(options?.nowMs) : Date.now();

  const [events, evaluations] = await Promise.all([listValidationEvents(limit), listEvaluationResults(limit)]);
  const outcomeMap = await buildOutcomeMapForValidationEvents(events);

  const windows = makeWindow(now).map<EvaluationReportWindow>((window) => {
    const scoped = filterByWindow(events, evaluations, window.fromTs, window.toTs);
    const scopedOutcomeMap = toOutcomeMap(outcomeMap, scoped.events);

    const roiRows = buildRoiRowsFromData(scoped.events, scopedOutcomeMap);
    const roiSummary = summarizeRoiRows(roiRows);
    const clvSummary = summarizeEvaluationResults(scoped.evaluations, {
      closeReference,
      roiSummary
    });

    const calibrationSamples = buildCalibrationSamplesFromData(scoped.events, scopedOutcomeMap);

    const roiCi = roiConfidenceIntervals(roiSummary);
    const roiProfits = roiRows
      .map((row) => row.profit)
      .filter((value): value is number => Number.isFinite(value));
    const clvCi = clvConfidenceIntervals(scoped.evaluations, closeReference);
    const confidenceCiWidth = confidenceIntervalWidth(roiCi.winRate) ?? confidenceIntervalWidth(clvCi.beatCloseRate);

    return {
      window: window.key,
      fromTs: window.fromTs,
      toTs: window.toTs,
      sampleSize: scoped.events.length,
      settledSampleSize: roiSummary.settledSampleSize,
      confidenceTier: confidenceTierForSampleSize({
        sampleSize: scoped.events.length,
        settledSampleSize: roiSummary.settledSampleSize,
        ciWidth: confidenceCiWidth
      }),
      clvPerformance: {
        sampleSize: clvSummary.sampleSize,
        beatCloseRate: clvSummary.beatCloseRate,
        averageClvProbDelta: clvSummary.averageClvProbDelta,
        confidenceIntervals: clvCi
      },
      roiPerformance: {
        ...roiSummary,
        confidenceIntervals: {
          roi: normalCi(roiProfits),
          winRate: roiCi.winRate
        }
      },
      probabilityCalibration: analyzeProbabilityCalibration(calibrationSamples),
      factorPerformance: buildFactorPerformanceFromData(scoped.events, scoped.evaluations, scopedOutcomeMap, {
        closeReference
      }),
      pressureSignalAnalysis: analyzePressureRelationshipsFromData(scoped.events, scoped.evaluations, scopedOutcomeMap, {
        closeReference
      })
    };
  });

  return {
    generatedAt: now,
    evaluationMethodology: method(closeReference),
    windows
  };
}
