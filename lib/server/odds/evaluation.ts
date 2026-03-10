import { getBookWeightAudit } from "@/lib/server/odds/weights";
import type { FairEvent, BookBehaviorSummary } from "@/lib/server/odds/types";
import type { OddsCalibration } from "@/lib/server/odds/calibration";
import type { PersistedValidationEvent } from "@/lib/server/odds/types";
import type { OutcomeResult } from "@/lib/server/odds/types";

type BookAccumulator = {
  key: string;
  title: string;
  samples: number;
  lagSignals: number;
  staleSignals: number;
  disagreementSignals: number;
  moveFirstSignals: number;
};

function toRate(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, count / total));
}

function confidenceBucket(samples: number, minSamples: number): "low" | "medium" | "high" {
  if (samples < minSamples) return "low";
  if (samples < minSamples * 2) return "medium";
  return "high";
}

function summarizeRow(row: BookBehaviorSummary): string {
  if (row.confidence === "low") {
    return "Sparse data; treat responsiveness as preliminary";
  }

  if (row.lagRate >= 0.35) {
    return "Often lags consensus and can offer late stale opportunities";
  }

  if (row.moveFirstRate >= 0.35 && row.disagreementRate < 0.2) {
    return "Frequently moves early and stays near consensus";
  }

  if (row.disagreementRate >= 0.3) {
    return "Frequently disagrees with consensus in current sample";
  }

  return "Mixed responsiveness profile in current window";
}

export function summarizeBookBehavior(
  events: FairEvent[],
  calibration: OddsCalibration
): BookBehaviorSummary[] {
  const byBook = new Map<string, BookAccumulator>();

  for (const event of events) {
    for (const outcome of event.outcomes) {
      for (const row of outcome.books) {
        const existing = byBook.get(row.bookKey);
        const acc =
          existing || {
            key: row.bookKey,
            title: row.title,
            samples: 0,
            lagSignals: 0,
            staleSignals: 0,
            disagreementSignals: 0,
            moveFirstSignals: 0
          };

        acc.samples += 1;

        const gap = Math.abs(row.consensusGapPct ?? 0);
        if (gap >= calibration.bookBehavior.lagConsensusGapPct) {
          acc.disagreementSignals += 1;
        }

        if (row.staleFlag === "lagging_book") {
          acc.lagSignals += 1;
        }

        if (row.staleActionable || row.staleFlag === "stale_price" || row.staleFlag === "best_market_confirmed") {
          acc.staleSignals += 1;
        }

        if (Math.abs(row.movement?.move ?? 0) >= calibration.bookBehavior.moveFirstThreshold) {
          acc.moveFirstSignals += 1;
        }

        byBook.set(row.bookKey, acc);
      }
    }
  }

  return Array.from(byBook.values())
    .map((acc) => {
      const tier = getBookWeightAudit(acc.key).tier;
      const lagRate = toRate(acc.lagSignals, acc.samples);
      const staleRate = toRate(acc.staleSignals, acc.samples);
      const disagreementRate = toRate(acc.disagreementSignals, acc.samples);
      const moveFirstRate = toRate(acc.moveFirstSignals, acc.samples);
      const confidence = confidenceBucket(acc.samples, calibration.bookBehavior.minSamplesForSignal);

      const row: BookBehaviorSummary = {
        bookKey: acc.key,
        title: acc.title,
        tier,
        samples: acc.samples,
        lagRate,
        staleRate,
        disagreementRate,
        moveFirstRate,
        confidence,
        summary: ""
      };
      row.summary = summarizeRow(row);
      return row;
    })
    .sort((a, b) => {
      const aScore = a.lagRate * 0.35 + a.staleRate * 0.25 + a.moveFirstRate * 0.2 + a.disagreementRate * 0.2;
      const bScore = b.lagRate * 0.35 + b.staleRate * 0.25 + b.moveFirstRate * 0.2 + b.disagreementRate * 0.2;
      return bScore - aScore;
    });
}

function confidenceBucketFromScore(score: number | null | undefined): "low" | "medium" | "high" {
  if (!Number.isFinite(score)) return "low";
  if ((score as number) >= 0.75) return "high";
  if ((score as number) >= 0.55) return "medium";
  return "low";
}

export function summarizeValidationDistributions(events: PersistedValidationEvent[]): {
  confidenceBuckets: Array<{ bucket: "low" | "medium" | "high"; count: number }>;
  evDefensibility: Array<{ label: string; count: number }>;
  penaltyReasons: Array<{ reason: string; count: number }>;
} {
  const confidence = new Map<"low" | "medium" | "high", number>([
    ["low", 0],
    ["medium", 0],
    ["high", 0]
  ]);
  const evDef = new Map<string, number>();
  const penalties = new Map<string, number>();

  for (const event of events) {
    const bucket = confidenceBucketFromScore(event.model.confidenceScore);
    confidence.set(bucket, (confidence.get(bucket) || 0) + 1);

    const def = event.model.evDefensibility || "unknown";
    evDef.set(def, (evDef.get(def) || 0) + 1);

    for (const reason of event.diagnostics.reasons || []) {
      penalties.set(reason, (penalties.get(reason) || 0) + 1);
    }
  }

  return {
    confidenceBuckets: Array.from(confidence.entries()).map(([bucket, count]) => ({ bucket, count })),
    evDefensibility: Array.from(evDef.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    penaltyReasons: Array.from(penalties.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
  };
}

export function summarizeOutcomeDistributions(
  outcomes: Array<{ result: OutcomeResult | null | undefined }>
): Array<{ result: OutcomeResult; count: number }> {
  const counts = new Map<OutcomeResult, number>([
    ["win", 0],
    ["loss", 0],
    ["push", 0],
    ["void", 0],
    ["unknown", 0]
  ]);

  for (const row of outcomes) {
    const result = row.result;
    if (result === "win" || result === "loss" || result === "push" || result === "void" || result === "unknown") {
      counts.set(result, (counts.get(result) || 0) + 1);
      continue;
    }
    counts.set("unknown", (counts.get("unknown") || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([result, count]) => ({ result, count }))
    .sort((a, b) => b.count - a.count);
}
