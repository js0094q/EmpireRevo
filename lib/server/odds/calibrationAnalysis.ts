import { listValidationEvents } from "@/lib/server/odds/validationStore";
import { buildOutcomeMapForValidationEvents } from "@/lib/server/odds/roiEvaluation";
import { buildOutcomeLookupKey } from "@/lib/server/odds/outcomes";
import { confidenceTierForSampleSize } from "@/lib/server/odds/sampleConfidence";
import type { PersistedOutcomeResult, PersistedValidationEvent, SampleConfidenceTier } from "@/lib/server/odds/types";

export type CalibrationBucketRow = {
  bucketLabel: string;
  bucketStart: number;
  bucketEnd: number;
  sampleSize: number;
  expectedWinRate: number | null;
  actualWinRate: number | null;
  calibrationError: number | null;
};

export type ProbabilityCalibrationSummary = {
  sampleSize: number;
  settledSampleSize: number;
  confidenceTier: SampleConfidenceTier;
  brierScore: number | null;
  logLoss: number | null;
  meanLogLoss: number | null;
  meanCalibrationError: number | null;
  maxCalibrationError: number | null;
  buckets: CalibrationBucketRow[];
};

type CalibrationSample = {
  fairProb: number;
  outcome: 0 | 1;
};

function clampProb(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampProbForLogLoss(value: number): number {
  return Math.max(1e-6, Math.min(1 - 1e-6, value));
}

function bucketBounds(prob: number, bucketSize: number): { start: number; end: number } {
  const safeBucket = Math.max(0.01, Math.min(0.25, bucketSize));
  const index = Math.floor(clampProb(prob) / safeBucket);
  const start = Math.max(0, Math.min(1 - safeBucket, Number((index * safeBucket).toFixed(10))));
  const end = Number(Math.min(1, start + safeBucket).toFixed(10));
  return { start, end };
}

function bucketLabel(start: number, end: number): string {
  return `${start.toFixed(2)}-${end.toFixed(2)}`;
}

export function analyzeProbabilityCalibration(
  samples: CalibrationSample[],
  bucketSize = 0.05,
  options?: { sampleSize?: number }
): ProbabilityCalibrationSummary {
  const byBucket = new Map<string, {
    start: number;
    end: number;
    count: number;
    probSum: number;
    wins: number;
  }>();

  const brierTerms: number[] = [];
  const logLossTerms: number[] = [];

  for (const sample of samples) {
    const p = clampProb(sample.fairProb);
    const safeP = clampProbForLogLoss(sample.fairProb);
    const y = sample.outcome;
    brierTerms.push((p - y) ** 2);
    logLossTerms.push(-((y * Math.log(safeP)) + ((1 - y) * Math.log(1 - safeP))));

    const bounds = bucketBounds(p, bucketSize);
    const key = `${bounds.start}:${bounds.end}`;
    const row = byBucket.get(key) || {
      start: bounds.start,
      end: bounds.end,
      count: 0,
      probSum: 0,
      wins: 0
    };

    row.count += 1;
    row.probSum += p;
    row.wins += y;
    byBucket.set(key, row);
  }

  const buckets = Array.from(byBucket.values())
    .map<CalibrationBucketRow>((row) => {
      const expectedWinRate = row.count > 0 ? row.probSum / row.count : null;
      const actualWinRate = row.count > 0 ? row.wins / row.count : null;
      const calibrationError =
        expectedWinRate !== null && actualWinRate !== null
          ? actualWinRate - expectedWinRate
          : null;

      return {
        bucketLabel: bucketLabel(row.start, row.end),
        bucketStart: row.start,
        bucketEnd: row.end,
        sampleSize: row.count,
        expectedWinRate,
        actualWinRate,
        calibrationError
      };
    })
    .sort((a, b) => a.bucketStart - b.bucketStart);

  const settledSampleSize = buckets.reduce((sum, row) => sum + row.sampleSize, 0);
  const sampleSize = Number.isFinite(options?.sampleSize)
    ? Math.max(settledSampleSize, Math.floor(Number(options?.sampleSize)))
    : settledSampleSize;
  const absErrorWeighted = buckets.reduce((sum, row) => {
    if (!Number.isFinite(row.calibrationError)) return sum;
    return sum + Math.abs(Number(row.calibrationError)) * row.sampleSize;
  }, 0);

  const maxCalibrationError = buckets.reduce((max, row) => {
    if (!Number.isFinite(row.calibrationError)) return max;
    return Math.max(max, Math.abs(Number(row.calibrationError)));
  }, 0);

  return {
    sampleSize,
    settledSampleSize,
    confidenceTier: confidenceTierForSampleSize(settledSampleSize > 0 ? settledSampleSize : sampleSize),
    brierScore: brierTerms.length ? brierTerms.reduce((sum, term) => sum + term, 0) / brierTerms.length : null,
    logLoss: logLossTerms.length ? logLossTerms.reduce((sum, term) => sum + term, 0) / logLossTerms.length : null,
    meanLogLoss: logLossTerms.length ? logLossTerms.reduce((sum, term) => sum + term, 0) / logLossTerms.length : null,
    meanCalibrationError: settledSampleSize > 0 ? absErrorWeighted / settledSampleSize : null,
    maxCalibrationError: buckets.length ? maxCalibrationError : null,
    buckets
  };
}

export function buildCalibrationSamplesFromData(
  events: PersistedValidationEvent[],
  outcomeMap: Map<string, PersistedOutcomeResult>
): CalibrationSample[] {
  const samples: CalibrationSample[] = [];
  for (const event of events) {
    if (!Number.isFinite(event.model.fairProb)) continue;
    const lookup = buildOutcomeLookupKey({
      sportKey: event.sportKey,
      eventId: event.eventId,
      marketKey: event.marketKey,
      sideKey: event.sideKey || "unknown"
    });
    const outcome = outcomeMap.get(lookup);
    if (!outcome) continue;
    if (outcome.result !== "win" && outcome.result !== "loss") continue;

    samples.push({
      fairProb: Number(event.model.fairProb),
      outcome: outcome.result === "win" ? 1 : 0
    });
  }
  return samples;
}

export async function buildProbabilityCalibration(limit = 500, bucketSize = 0.05): Promise<ProbabilityCalibrationSummary> {
  const events = await listValidationEvents(limit);
  const outcomeMap = await buildOutcomeMapForValidationEvents(events);
  const samples = buildCalibrationSamplesFromData(events, outcomeMap);
  return analyzeProbabilityCalibration(samples, bucketSize, { sampleSize: events.length });
}
