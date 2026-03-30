import { getOddsCalibration, type OddsCalibration } from "@/lib/server/odds/calibration";
import type { ConfidenceBreakdown, FairEventBookExclusion, FairOutcomeBook } from "@/lib/server/odds/types";

export type ConfidenceLabel =
  | "High Confidence"
  | "Moderate Confidence"
  | "Thin Market"
  | "Stale Market"
  | "Limited Sharp Coverage";

export type ConfidenceAssessment = {
  score: number;
  label: ConfidenceLabel;
  notes: string[];
  coverageRatio: number;
  sharpParticipation: number;
  freshnessScore: number;
  dispersionScore: number;
  historyQuality: number;
  breakdown: ConfidenceBreakdown;
};

type ConfidenceParams = {
  books: FairOutcomeBook[];
  contributingBooks: number;
  totalBooks: number;
  excludedBooks: FairEventBookExclusion[];
  nowMs?: number;
  calibration?: OddsCalibration;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const sq = values.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  return sq / (values.length - 1);
}

function freshnessScore(books: FairOutcomeBook[], nowMs: number, calibration: OddsCalibration): number {
  const ages = books
    .map((book) => (book.lastUpdate ? nowMs - Date.parse(book.lastUpdate) : Number.POSITIVE_INFINITY))
    .filter((age) => Number.isFinite(age));

  if (!ages.length) return calibration.confidence.fallbackScores.missingFreshness;

  const medianAgeMs = [...ages].sort((a, b) => a - b)[Math.floor(ages.length / 2)] ?? Number.POSITIVE_INFINITY;
  const freshMs = calibration.confidence.freshness.freshMinutes * 60 * 1000;
  const staleMs = calibration.confidence.freshness.staleMinutes * 60 * 1000;

  if (medianAgeMs <= freshMs) return 1;
  if (medianAgeMs >= staleMs) return 0.1;
  return clamp01(1 - (medianAgeMs - freshMs) / (staleMs - freshMs));
}

function dispersionScore(books: FairOutcomeBook[], calibration: OddsCalibration): number {
  const probs = books.map((book) => book.impliedProbNoVig).filter((value) => Number.isFinite(value));
  if (probs.length < 2) return calibration.confidence.fallbackScores.sparseDispersion;
  const v = variance(probs);
  return clamp01(1 - v / calibration.confidence.dispersion.varianceNoiseCap);
}

function historyQuality(books: FairOutcomeBook[], calibration: OddsCalibration): number {
  const samples = books.map((book) => book.movement?.history?.length ?? 0);
  if (!samples.length) return calibration.confidence.fallbackScores.sparseHistory;
  const avg = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const strong = calibration.confidence.history.strongAvgSamples;
  const weak = calibration.confidence.history.weakAvgSamples;

  if (avg >= strong) return 1;
  if (avg <= weak) return 0.2;
  return clamp01(avg / strong);
}

function normalizeActiveWeights(weights: {
  coverage: number;
  sharpParticipation: number;
  freshness: number;
  dispersion: number;
  exclusions: number;
}): {
  coverage: number;
  sharpParticipation: number;
  freshness: number;
  dispersion: number;
  exclusions: number;
} {
  const total =
    weights.coverage +
    weights.sharpParticipation +
    weights.freshness +
    weights.dispersion +
    weights.exclusions;

  if (total <= 0) {
    return {
      coverage: 0.25,
      sharpParticipation: 0.2,
      freshness: 0.2,
      dispersion: 0.2,
      exclusions: 0.15
    };
  }

  return {
    coverage: weights.coverage / total,
    sharpParticipation: weights.sharpParticipation / total,
    freshness: weights.freshness / total,
    dispersion: weights.dispersion / total,
    exclusions: weights.exclusions / total
  };
}

export function assessConfidence(params: ConfidenceParams): ConfidenceAssessment {
  const calibration = params.calibration ?? getOddsCalibration();
  const nowMs = params.nowMs ?? Date.now();
  const total = Math.max(1, params.totalBooks);
  const coverageRatio = clamp01(params.contributingBooks / total);
  const sharpBooks = params.books.filter((book) => book.isSharpBook).length;
  const sharpParticipation = params.books.length ? clamp01(sharpBooks / params.books.length) : 0;
  const fresh = freshnessScore(params.books, nowMs, calibration);
  const disperse = dispersionScore(params.books, calibration);
  const history = historyQuality(params.books, calibration);
  const exclusionPenalty = clamp01(params.excludedBooks.length / total);
  const liveWeights = normalizeActiveWeights({
    coverage: calibration.confidence.componentWeights.coverage,
    sharpParticipation: calibration.confidence.componentWeights.sharpParticipation,
    freshness: calibration.confidence.componentWeights.freshness,
    dispersion: calibration.confidence.componentWeights.dispersion,
    exclusions: calibration.confidence.componentWeights.exclusions
  });

  const contributions = {
    coverage: liveWeights.coverage * coverageRatio,
    sharpParticipation: liveWeights.sharpParticipation * sharpParticipation,
    freshness: liveWeights.freshness * fresh,
    dispersion: liveWeights.dispersion * disperse,
    history: 0,
    exclusions: liveWeights.exclusions * (1 - exclusionPenalty)
  };

  const score = clamp01(
    contributions.coverage +
      contributions.sharpParticipation +
      contributions.freshness +
      contributions.dispersion +
      contributions.history +
      contributions.exclusions
  );

  const notes: string[] = [];
  if (coverageRatio >= calibration.confidence.noteThresholds.broadCoverage) notes.push("Broad book participation");
  else if (coverageRatio < calibration.confidence.noteThresholds.thinCoverage) notes.push("Thin coverage across books");

  if (sharpParticipation >= calibration.confidence.noteThresholds.strongSharp) notes.push("Sharp-book participation present");
  else notes.push("Limited sharp-book participation");

  if (fresh >= calibration.confidence.noteThresholds.fresh) notes.push("Recent market updates");
  else if (fresh < calibration.confidence.noteThresholds.stale) notes.push("Stale market timestamps");

  if (disperse < calibration.confidence.noteThresholds.highDisagreement) notes.push("Book disagreement is elevated");
  if (history < calibration.confidence.noteThresholds.sparseHistory) notes.push("Movement history is sparse");

  let label: ConfidenceLabel = "Moderate Confidence";
  if (coverageRatio < calibration.confidence.labelThresholds.thinCoverage) label = "Thin Market";
  else if (fresh < calibration.confidence.labelThresholds.staleFreshness) label = "Stale Market";
  else if (sharpParticipation < calibration.confidence.labelThresholds.limitedSharp) label = "Limited Sharp Coverage";
  else if (score >= calibration.confidence.labelThresholds.highConfidence) label = "High Confidence";

  return {
    score,
    label,
    notes,
    coverageRatio,
    sharpParticipation,
    freshnessScore: fresh,
    dispersionScore: disperse,
    historyQuality: history,
    breakdown: {
      coverageRatio,
      sharpParticipation,
      freshnessScore: fresh,
      dispersionScore: disperse,
      historyQuality: history,
      exclusionPenalty,
      componentContributions: contributions
    }
  };
}
