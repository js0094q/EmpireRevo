import { getEvaluationSummary, evaluateRecentValidationEvents } from "@/lib/server/odds/evaluationRunner";
import { analyzePressureRelationships } from "@/lib/server/odds/marketPressure";
import {
  listEvaluationResults,
  listValidationEvents,
  readFactorDiagnostics,
  validationDateBucket,
  writeFactorDiagnostics
} from "@/lib/server/odds/validationStore";
import type { PersistedEvaluationResult, PersistedValidationEvent } from "@/lib/server/odds/types";

export type FactorContributionRow = {
  factor: string;
  samples: number;
  avgWhenBeat: number | null;
  avgWhenMiss: number | null;
  delta: number | null;
};

export type PenaltyCorrelationRow = {
  reason: string;
  samples: number;
  failRate: number | null;
};

export type FactorAnalyticsSummary = {
  sampleSize: number;
  evaluatedSampleSize: number;
  factorContributions: FactorContributionRow[];
  penaltyCorrelations: PenaltyCorrelationRow[];
  defensibilityPerformance: Array<{ class: string; samples: number; beatCloseRate: number | null }>;
  pinnedVsGlobal: {
    samples: number;
    globalBeatRate: number | null;
    pinnedBeatRate: number | null;
  };
  confidencePerformance: Array<{ bucket: "low" | "medium" | "high"; samples: number; beatCloseRate: number | null }>;
  rankingDecilePerformance: Array<{ decile: number; samples: number; beatCloseRate: number | null }>;
  pressureVsCLV: Array<{ pressureBucket: "low" | "medium" | "high"; samples: number; avgClvProbDelta: number | null }>;
  pressureVsROI: Array<{ pressureBucket: "low" | "medium" | "high"; samples: number; avgROI: number | null }>;
  pressureVsTiming: Array<{ pressureBucket: "low" | "medium" | "high"; samples: number; likelyClosingRate: number | null }>;
};

function toRate(hits: number, total: number): number | null {
  if (total <= 0) return null;
  return hits / total;
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildJoin(
  events: PersistedValidationEvent[],
  evaluations: PersistedEvaluationResult[]
): Array<{ event: PersistedValidationEvent; evaluation: PersistedEvaluationResult }> {
  const byValidationId = new Map<string, PersistedEvaluationResult>();
  for (const evaluation of evaluations) {
    if (!byValidationId.has(evaluation.validationEventId)) {
      byValidationId.set(evaluation.validationEventId, evaluation);
      continue;
    }

    const existing = byValidationId.get(evaluation.validationEventId);
    if ((existing?.createdAt || 0) < evaluation.createdAt) {
      byValidationId.set(evaluation.validationEventId, evaluation);
    }
  }

  return events
    .map((event) => {
      const evaluation = byValidationId.get(event.id);
      if (!evaluation) return null;
      return { event, evaluation };
    })
    .filter((entry): entry is { event: PersistedValidationEvent; evaluation: PersistedEvaluationResult } => Boolean(entry));
}

export async function buildFactorAnalytics(limit = 300): Promise<FactorAnalyticsSummary> {
  const dateBucket = validationDateBucket(Date.now());
  const cacheKey = `${dateBucket}:limit:${limit}`;
  const cached = await readFactorDiagnostics<FactorAnalyticsSummary>(cacheKey);
  if (cached) return cached;

  const events = await listValidationEvents(limit);
  const currentEvaluations = await listEvaluationResults(limit);
  const evaluations = currentEvaluations.length ? currentEvaluations : await evaluateRecentValidationEvents(limit);
  const joined = buildJoin(events, evaluations);

  const contributions = new Map<string, { beat: number[]; miss: number[]; samples: number }>();
  const penalties = new Map<string, { samples: number; fails: number }>();

  for (const pair of joined) {
    const beat = pair.evaluation.beatCloseGlobal === true;
    const breakdown = pair.event.diagnostics.factorBreakdown || {};
    for (const [factor, contribution] of Object.entries(breakdown)) {
      const row = contributions.get(factor) || { beat: [], miss: [], samples: 0 };
      row.samples += 1;
      if (beat) {
        row.beat.push(contribution);
      } else {
        row.miss.push(contribution);
      }
      contributions.set(factor, row);
    }

    const reasons = pair.event.diagnostics.reasons || [];
    for (const reason of reasons) {
      const row = penalties.get(reason) || { samples: 0, fails: 0 };
      row.samples += 1;
      if (!beat) {
        row.fails += 1;
      }
      penalties.set(reason, row);
    }
  }

  const factorContributions = Array.from(contributions.entries())
    .map<FactorContributionRow>(([factor, row]) => {
      const avgWhenBeat = average(row.beat);
      const avgWhenMiss = average(row.miss);
      return {
        factor,
        samples: row.samples,
        avgWhenBeat,
        avgWhenMiss,
        delta: avgWhenBeat !== null && avgWhenMiss !== null ? avgWhenBeat - avgWhenMiss : null
      };
    })
    .sort((a, b) => Math.abs(b.delta || 0) - Math.abs(a.delta || 0));

  const penaltyCorrelations = Array.from(penalties.entries())
    .map<PenaltyCorrelationRow>(([reason, row]) => ({
      reason,
      samples: row.samples,
      failRate: toRate(row.fails, row.samples)
    }))
    .sort((a, b) => (b.failRate || 0) - (a.failRate || 0));

  const [evaluationSummary, pressure] = await Promise.all([
    getEvaluationSummary(limit),
    analyzePressureRelationships(limit)
  ]);

  const summary: FactorAnalyticsSummary = {
    sampleSize: events.length,
    evaluatedSampleSize: joined.length,
    factorContributions,
    penaltyCorrelations,
    defensibilityPerformance: evaluationSummary.evDefensibility,
    pinnedVsGlobal: evaluationSummary.pinnedVsGlobal,
    confidencePerformance: evaluationSummary.confidenceBuckets,
    rankingDecilePerformance: evaluationSummary.rankingDeciles,
    pressureVsCLV: pressure.pressureVsCLV.map((row) => ({
      pressureBucket: row.pressureBucket,
      samples: row.samples,
      avgClvProbDelta: row.avgClvProbDelta
    })),
    pressureVsROI: pressure.pressureVsROI.map((row) => ({
      pressureBucket: row.pressureBucket,
      samples: row.samples,
      avgROI: row.avgROI
    })),
    pressureVsTiming: pressure.pressureVsTiming.map((row) => ({
      pressureBucket: row.pressureBucket,
      samples: row.samples,
      likelyClosingRate: row.likelyClosingRate
    }))
  };

  await writeFactorDiagnostics(cacheKey, summary);
  return summary;
}
