import type { MarketKey } from "@/lib/odds/schemas";
import { getOddsCalibration, type OddsCalibration } from "@/lib/server/odds/calibration";
import type { ConfidenceAssessment } from "@/lib/server/odds/confidence";
import type {
  ScoreBreakdown,
  FairOutcomeBook,
  MarketPressureSignal,
  ValueTimingSignal
} from "@/lib/server/odds/types";

export type OpportunityRanking = {
  score: number;
  confidenceAdjustedEdge: number;
  bestEdgePct: number;
  bestEvPct: number;
  bestBookKey: string;
  staleStrength: number;
  sharpDeviation: number;
  reasons: string[];
  breakdown: ScoreBreakdown;
};

type RankParams = {
  market: MarketKey;
  confidence: ConfidenceAssessment;
  books: FairOutcomeBook[];
  contributingBooks: number;
  totalBooks: number;
  marketPressure?: MarketPressureSignal;
  valueTiming?: ValueTimingSignal;
  calibration?: OddsCalibration;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function normalize(value: number, max: number): number {
  if (!Number.isFinite(value) || max <= 0) return 0;
  return clamp01(value / max);
}

function sharpDeviation(books: FairOutcomeBook[]): number {
  const sharp = books.filter((book) => book.isSharpBook).map((book) => book.edgePct);
  const retail = books.filter((book) => !book.isSharpBook).map((book) => book.edgePct);
  if (!sharp.length || !retail.length) return 0;
  const sharpAvg = sharp.reduce((sum, value) => sum + value, 0) / sharp.length;
  const retailAvg = retail.reduce((sum, value) => sum + value, 0) / retail.length;
  return sharpAvg - retailAvg;
}

export function rankOpportunity(params: RankParams): OpportunityRanking {
  const calibration = params.calibration ?? getOddsCalibration();
  const best = [...params.books].sort((a, b) => b.edgePct - a.edgePct || b.evPct - a.evPct)[0];
  const bestWithQualifiedEv = [...params.books].filter((book) => book.evQualified).sort((a, b) => b.evPct - a.evPct)[0];
  const bestEdgePct = Math.max(0, best?.edgePct ?? 0);
  const bestEvPct = bestWithQualifiedEv?.evPct ?? 0;
  const bestBookKey = best?.bookKey ?? "";
  const staleStrength = params.books.reduce((max, book) => Math.max(max, book.staleStrength ?? 0), 0);
  const sharpDev = sharpDeviation(params.books);
  const coverageRatio = params.totalBooks > 0 ? params.contributingBooks / params.totalBooks : 0;
  const evFactor = calibration.ranking.evWeightByMarket[params.market];

  const edgeScore = normalize(bestEdgePct, calibration.ranking.normalization.edgePctMax);
  const evScore = normalize(Math.max(0, bestEvPct), calibration.ranking.normalization.evPctMax) * evFactor;
  const confidenceScore = params.confidence.score;
  const staleScore = staleStrength;
  const coverageScore = clamp01(coverageRatio);
  const sharpScore = params.confidence.sharpParticipation;
  const freshnessScore = params.confidence.freshnessScore;
  const deviationScore = normalize(Math.abs(sharpDev), calibration.ranking.normalization.sharpDeviationMax);

  const componentContributions = {
    edge: calibration.ranking.componentWeights.edge * edgeScore,
    ev: calibration.ranking.componentWeights.ev * evScore,
    confidence: calibration.ranking.componentWeights.confidence * confidenceScore,
    coverage: calibration.ranking.componentWeights.coverage * coverageScore,
    sharpParticipation: calibration.ranking.componentWeights.sharpParticipation * sharpScore,
    freshness: calibration.ranking.componentWeights.freshness * freshnessScore,
    stale: calibration.ranking.componentWeights.stale * staleScore,
    sharpDeviation: calibration.ranking.componentWeights.sharpDeviation * deviationScore
  };

  let score =
    100 *
    (componentContributions.edge +
      componentContributions.ev +
      componentContributions.confidence +
      componentContributions.coverage +
      componentContributions.sharpParticipation +
      componentContributions.freshness +
      componentContributions.stale +
      componentContributions.sharpDeviation);

  const penalties: Array<{ reason: string; delta: number }> = [];
  if (coverageRatio < calibration.ranking.penalties.sparseCoverageThreshold) {
    penalties.push({ reason: "Sparse market coverage", delta: -calibration.ranking.penalties.sparseCoveragePenalty });
  }
  if (params.confidence.sharpParticipation < calibration.ranking.penalties.limitedSharpThreshold) {
    penalties.push({ reason: "Limited sharp participation", delta: -calibration.ranking.penalties.limitedSharpPenalty });
  }
  if (params.confidence.freshnessScore < calibration.ranking.penalties.staleFreshnessThreshold) {
    penalties.push({ reason: "Freshness penalty", delta: -calibration.ranking.penalties.staleFreshnessPenalty });
  }
  if (params.confidence.label === "Thin Market" || params.confidence.label === "Stale Market") {
    penalties.push({ reason: "Weak confidence label", delta: -calibration.ranking.penalties.weakLabelPenalty });
  }
  if (params.marketPressure?.label === "fragmented") {
    penalties.push({ reason: "Fragmented historical movement", delta: -calibration.ranking.historyAdjustments.fragmentedPenalty });
  }
  if (params.marketPressure?.label === "stale") {
    penalties.push({ reason: "Stale historical market", delta: -calibration.ranking.historyAdjustments.staleHistoryPenalty });
  }
  if (params.valueTiming?.edgeTrend === "worsening") {
    penalties.push({ reason: "Edge trend worsening", delta: -calibration.ranking.historyAdjustments.worseningEdgePenalty });
  }

  for (const penalty of penalties) {
    score += penalty.delta;
  }

  if (params.valueTiming?.valuePersistence === "stable") {
    score += calibration.ranking.historyAdjustments.persistentEdgeBoost;
    penalties.push({
      reason: "Persistent positive value",
      delta: calibration.ranking.historyAdjustments.persistentEdgeBoost
    });
  } else if (params.valueTiming?.valuePersistence === "developing") {
    score += calibration.ranking.historyAdjustments.persistentEdgeBoost / 2;
    penalties.push({
      reason: "Developing positive value",
      delta: calibration.ranking.historyAdjustments.persistentEdgeBoost / 2
    });
  }

  if (params.marketPressure?.label === "sharp-up" || params.marketPressure?.label === "sharp-down") {
    score += calibration.ranking.historyAdjustments.sharpConfirmationBoost;
    penalties.push({
      reason: "Sharp-led confirmation",
      delta: calibration.ranking.historyAdjustments.sharpConfirmationBoost
    });
  }

  score = Math.max(0, Math.round(score * 10) / 10);

  const reasons: string[] = [];
  if (bestEdgePct >= calibration.ranking.reasonThresholds.edgePct) {
    reasons.push(`Edge ${bestEdgePct.toFixed(2)}% at ${best?.title ?? "best book"}`);
  }
  if (params.confidence.sharpParticipation >= calibration.ranking.reasonThresholds.sharpParticipation) {
    reasons.push("Sharp books are participating");
  }
  if (coverageRatio >= calibration.ranking.reasonThresholds.broadCoverage) {
    reasons.push("Market coverage is broad");
  }
  if (staleStrength >= calibration.ranking.reasonThresholds.staleStrength) {
    reasons.push("Stale-line signal is present");
  }
  if (params.confidence.freshnessScore < calibration.ranking.reasonThresholds.freshnessPenalty) {
    reasons.push("Freshness penalty applied");
  }
  if (params.market !== "h2h") {
    reasons.push("EV de-emphasized outside moneyline");
  }

  return {
    score,
    confidenceAdjustedEdge: bestEdgePct * (0.4 + 0.6 * confidenceScore),
    bestEdgePct,
    bestEvPct,
    bestBookKey,
    staleStrength,
    sharpDeviation: sharpDev,
    reasons,
    breakdown: {
      edgeScore,
      evScore,
      confidenceScore,
      coverageScore,
      sharpScore,
      freshnessScore,
      staleScore,
      deviationScore,
      componentContributions,
      penaltiesApplied: penalties
    }
  };
}
