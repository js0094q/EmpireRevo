import type { MarketKey } from "@/lib/odds/schemas";
import {
  buildPriceVsFairMetrics,
  classifyOpportunityStrength,
  computeActionableValueScore
} from "@/lib/odds/priceValue";
import { getOddsCalibration, type OddsCalibration } from "@/lib/server/odds/calibration";
import type { ConfidenceAssessment } from "@/lib/server/odds/confidence";
import { getOddsHistoryConfig } from "@/lib/server/odds/historyConfig";
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
  const historyMode = getOddsHistoryConfig().liveRankingMode;
  const best = [...params.books].sort((a, b) => b.edgePct - a.edgePct || b.evPct - a.evPct)[0];
  const bestWithQualifiedEv = [...params.books].filter((book) => book.evQualified).sort((a, b) => b.evPct - a.evPct)[0];
  const bestEdgePct = Math.max(0, best?.edgePct ?? 0);
  const bestEvPct = bestWithQualifiedEv?.evPct ?? 0;
  const bestBookKey = best?.bookKey ?? "";
  const staleStrength = params.books.reduce(
    (max, book) => (book.staleActionable ? Math.max(max, book.staleStrength ?? 0) : max),
    0
  );
  const sharpDev = sharpDeviation(params.books);
  const sharpDevPositive = Math.max(0, sharpDev);
  const sharpDevNegative = Math.max(0, -sharpDev);
  const coverageRatio = params.totalBooks > 0 ? params.contributingBooks / params.totalBooks : 0;
  const evFactor = calibration.ranking.evWeightByMarket[params.market];

  const edgeScore = normalize(bestEdgePct, calibration.ranking.normalization.edgePctMax);
  const evScore = normalize(Math.max(0, bestEvPct), calibration.ranking.normalization.evPctMax) * evFactor;
  const confidenceScore = params.confidence.score;
  const staleScore = staleStrength;
  const coverageScore = clamp01(coverageRatio);
  const sharpScore = params.confidence.sharpParticipation;
  const freshnessScore = params.confidence.freshnessScore;
  const deviationScore = normalize(sharpDevPositive, calibration.ranking.normalization.sharpDeviationMax);

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
  if (best) {
    const metrics = buildPriceVsFairMetrics({
      marketPriceAmerican: Number.isFinite(best.marketPriceAmerican) ? Number(best.marketPriceAmerican) : best.priceAmerican,
      fairPriceAmerican: Number.isFinite(best.fairPriceAmerican) ? Number(best.fairPriceAmerican) : best.priceAmerican,
      marketImpliedProb: Number.isFinite(best.marketImpliedProb) ? Number(best.marketImpliedProb) : best.impliedProbNoVig,
      fairImpliedProb: Number.isFinite(best.fairImpliedProb) ? Number(best.fairImpliedProb) : best.impliedProbNoVig
    });
    const actionableValueScore = computeActionableValueScore({
      marketPrice: metrics.marketPriceAmerican,
      fairPrice: metrics.fairPriceAmerican,
      marketImpliedProb: metrics.marketImpliedProb,
      fairImpliedProb: metrics.fairImpliedProb,
      probabilityGapPctPoints: metrics.probabilityGapPct,
      priceValueDirection: metrics.priceValueDirection
    });
    const strength = classifyOpportunityStrength({
      marketPrice: metrics.marketPriceAmerican,
      fairPrice: metrics.fairPriceAmerican,
      marketImpliedProb: metrics.marketImpliedProb,
      fairImpliedProb: metrics.fairImpliedProb,
      probabilityGapPctPoints: metrics.probabilityGapPct,
      priceValueDirection: metrics.priceValueDirection
    });

    // Actionability should directly influence ranking so thin longshots cannot dominate.
    score += Math.max(-6, Math.min(12, actionableValueScore * 1.5));

    if (metrics.priceValueDirection !== "better_than_fair") {
      penalties.push({ reason: "Available price not better than fair", delta: -4 });
    } else if (strength === "longshot_thin") {
      penalties.push({ reason: "Longshot profile with thin signal", delta: -45 });
    } else if (strength === "thin") {
      penalties.push({ reason: "Thin value signal", delta: -12 });
    } else if (strength === "moderate") {
      score += 1.5;
    } else if (strength === "strong") {
      score += 3;
    }

    if (actionableValueScore < 0) {
      penalties.push({ reason: "Negative actionable-value score", delta: -6 });
    } else if (actionableValueScore < 2) {
      penalties.push({ reason: "Low actionable-value score", delta: -4 });
    }
  }
  if (coverageRatio < calibration.ranking.penalties.sparseCoverageThreshold) {
    penalties.push({ reason: "Sparse market coverage", delta: -calibration.ranking.penalties.sparseCoveragePenalty });
  }
  if (params.confidence.sharpParticipation < calibration.ranking.penalties.limitedSharpThreshold) {
    penalties.push({ reason: "Limited sharp participation", delta: -calibration.ranking.penalties.limitedSharpPenalty });
  }
  if (params.confidence.freshnessScore < calibration.ranking.penalties.staleFreshnessThreshold) {
    penalties.push({ reason: "Freshness penalty", delta: -calibration.ranking.penalties.staleFreshnessPenalty });
  }
  if (sharpDevNegative > 0) {
    penalties.push({
      reason: "Sharp books disagree with displayed edge",
      delta: -2 * normalize(sharpDevNegative, calibration.ranking.normalization.sharpDeviationMax)
    });
  }
  if (params.confidence.label === "Thin Market" || params.confidence.label === "Stale Market") {
    penalties.push({ reason: "Weak confidence label", delta: -calibration.ranking.penalties.weakLabelPenalty });
  }
  const offMarketOutlier = params.books.some((book) => book.staleFlag === "off_market");
  if (offMarketOutlier) {
    penalties.push({ reason: "Off-market outlier present", delta: -2 });
  }

  const appliedHistoryReasons: string[] = [];
  if (historyMode !== "off" && params.marketPressure && params.marketPressure.confidence !== "low") {
    if (params.marketPressure.label === "fragmented") {
      penalties.push({
        reason: "Fragmented historical movement",
        delta: -calibration.ranking.historyAdjustments.fragmentedPenalty
      });
      appliedHistoryReasons.push("Historical movement is fragmented");
    } else if (params.marketPressure.label === "stale") {
      penalties.push({
        reason: "Stale historical market",
        delta: -calibration.ranking.historyAdjustments.staleHistoryPenalty
      });
      appliedHistoryReasons.push("Historical signal is stale");
    } else if (params.marketPressure.label === "sharp-up" || params.marketPressure.label === "sharp-down") {
      score += calibration.ranking.historyAdjustments.sharpConfirmationBoost;
      appliedHistoryReasons.push("Sharp books moved first");
    }
  }

  if (historyMode === "full" && params.valueTiming) {
    if (params.valueTiming.valuePersistence === "stable") {
      score += calibration.ranking.historyAdjustments.persistentEdgeBoost;
      appliedHistoryReasons.push("Positive value has persisted");
    } else if (params.valueTiming.valuePersistence === "developing") {
      score += Math.max(1, calibration.ranking.historyAdjustments.persistentEdgeBoost - 1);
      appliedHistoryReasons.push("Positive value is developing");
    }

    if (params.valueTiming.edgeTrend === "worsening") {
      penalties.push({
        reason: "Probability-gap trend worsening",
        delta: -calibration.ranking.historyAdjustments.worseningEdgePenalty
      });
      appliedHistoryReasons.push("Historical probability gap is worsening");
    }
  }

  for (const penalty of penalties) {
    score += penalty.delta;
  }

  score = Math.max(0, Math.round(score * 10) / 10);

  const reasons: string[] = [];
  if (bestEdgePct >= calibration.ranking.reasonThresholds.edgePct) {
    reasons.push(`Probability gap ${bestEdgePct.toFixed(2)}pp at ${best?.title ?? "best book"}`);
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
  for (const reason of appliedHistoryReasons) {
    if (!reasons.includes(reason)) {
      reasons.push(reason);
    }
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
