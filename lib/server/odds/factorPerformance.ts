import { listEvaluationResults, listValidationEvents } from "@/lib/server/odds/validationStore";
import { buildOutcomeLookupKey } from "@/lib/server/odds/outcomes";
import { confidenceTierForSampleSize } from "@/lib/server/odds/sampleConfidence";
import {
  buildOutcomeMapForValidationEvents,
  computeOutcomeProfit
} from "@/lib/server/odds/roiEvaluation";
import type {
  CloseReferenceMethod,
  OutcomeResult,
  PersistedEvaluationResult,
  PersistedOutcomeResult,
  PersistedValidationEvent,
  SampleConfidenceTier
} from "@/lib/server/odds/types";

export type FactorPerformanceRow = {
  factor: string;
  sampleSize: number;
  settledSampleSize: number;
  avgCLV: number | null;
  avgROI: number | null;
  winRate: number | null;
};

export type FactorPerformanceSummary = {
  sampleSize: number;
  settledSampleSize: number;
  confidenceTier: SampleConfidenceTier;
  factors: FactorPerformanceRow[];
};

type FactorAccumulator = {
  sampleSize: number;
  settledSampleSize: number;
  clvValues: number[];
  roiValues: number[];
  wins: number;
  losses: number;
};

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function latestEvaluationByValidationId(evaluations: PersistedEvaluationResult[]): Map<string, PersistedEvaluationResult> {
  const byValidationId = new Map<string, PersistedEvaluationResult>();
  for (const evaluation of evaluations) {
    const existing = byValidationId.get(evaluation.validationEventId);
    if (!existing || existing.createdAt < evaluation.createdAt) {
      byValidationId.set(evaluation.validationEventId, evaluation);
    }
  }
  return byValidationId;
}

function clvByReference(
  evaluation: PersistedEvaluationResult,
  closeReference: CloseReferenceMethod
): number | null {
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

function factorValues(event: PersistedValidationEvent): Map<string, number> {
  const values = new Map<string, number>();
  for (const [factor, contribution] of Object.entries(event.diagnostics.factorBreakdown || {})) {
    if (!Number.isFinite(contribution)) continue;
    values.set(factor, Number(contribution));
  }

  if (Number.isFinite(event.diagnostics.stalePenalty)) {
    values.set("marketPressure", Number(event.diagnostics.stalePenalty));
  }

  const sharpConsensus = event.diagnostics.factorBreakdown?.sharpParticipation;
  if (Number.isFinite(sharpConsensus)) {
    values.set("sharpConsensus", Number(sharpConsensus));
  }

  if (Number.isFinite(event.diagnostics.timingPenalty)) {
    values.set("timingSignal", 1 - Number(event.diagnostics.timingPenalty));
  }

  if (Number.isFinite(event.model.confidenceScore)) {
    values.set("confidenceScore", Number(event.model.confidenceScore));
  }

  return values;
}

function winLossFromOutcome(result: OutcomeResult | null): { win: number; loss: number } {
  if (result === "win") return { win: 1, loss: 0 };
  if (result === "loss") return { win: 0, loss: 1 };
  return { win: 0, loss: 0 };
}

export function buildFactorPerformanceFromData(
  events: PersistedValidationEvent[],
  evaluations: PersistedEvaluationResult[],
  outcomeMap: Map<string, PersistedOutcomeResult>,
  options?: { closeReference?: CloseReferenceMethod }
): FactorPerformanceSummary {
  const closeReference = options?.closeReference || "closing_global_best";
  const byValidationId = latestEvaluationByValidationId(evaluations);
  const byFactor = new Map<string, FactorAccumulator>();
  let settledSampleSize = 0;

  for (const event of events) {
    const eventFactors = factorValues(event);
    if (!eventFactors.size) continue;

    const evaluation = byValidationId.get(event.id) || null;
    const lookup = buildOutcomeLookupKey({
      sportKey: event.sportKey,
      eventId: event.eventId,
      marketKey: event.marketKey,
      sideKey: event.sideKey || "unknown"
    });
    const outcome = outcomeMap.get(lookup) || null;
    const profit = computeOutcomeProfit(outcome?.result || null, event.execution.displayedPriceAmerican ?? null);
    const winLoss = winLossFromOutcome(outcome?.result || null);
    if (Number.isFinite(profit)) {
      settledSampleSize += 1;
    }

    for (const factor of eventFactors.keys()) {
      const row = byFactor.get(factor) || {
        sampleSize: 0,
        settledSampleSize: 0,
        clvValues: [],
        roiValues: [],
        wins: 0,
        losses: 0
      };

      row.sampleSize += 1;

      if (evaluation) {
        const clv = clvByReference(evaluation, closeReference);
        if (Number.isFinite(clv)) {
          row.clvValues.push(Number(clv));
        }
      }

      if (Number.isFinite(profit)) {
        row.settledSampleSize += 1;
        row.roiValues.push(Number(profit));
        row.wins += winLoss.win;
        row.losses += winLoss.loss;
      }

      byFactor.set(factor, row);
    }
  }

  const factors = Array.from(byFactor.entries())
    .map<FactorPerformanceRow>(([factor, row]) => {
      const decisions = row.wins + row.losses;
      return {
        factor,
        sampleSize: row.sampleSize,
        settledSampleSize: row.settledSampleSize,
        avgCLV: avg(row.clvValues),
        avgROI: avg(row.roiValues),
        winRate: decisions > 0 ? row.wins / decisions : null
      };
    })
    .sort((a, b) => b.sampleSize - a.sampleSize);

  return {
    sampleSize: events.length,
    settledSampleSize,
    confidenceTier: confidenceTierForSampleSize(settledSampleSize > 0 ? settledSampleSize : events.length),
    factors
  };
}

export async function buildFactorPerformance(
  limit = 500,
  options?: { closeReference?: CloseReferenceMethod }
): Promise<FactorPerformanceSummary> {
  const [events, evaluations] = await Promise.all([listValidationEvents(limit), listEvaluationResults(limit)]);
  const outcomeMap = await buildOutcomeMapForValidationEvents(events);
  return buildFactorPerformanceFromData(events, evaluations, outcomeMap, options);
}
