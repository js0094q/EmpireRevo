import { getOddsCalibration, type OddsCalibration } from "@/lib/server/odds/calibration";
import type { ConfidenceAssessment } from "@/lib/server/odds/confidence";
import type { FairOutcomeBook, TimingSignal } from "@/lib/server/odds/types";

type TimingParams = {
  books: FairOutcomeBook[];
  confidence: ConfidenceAssessment;
  staleStrength: number;
  movementQuality: "strong" | "moderate" | "weak";
  movedBooks: number;
  calibration?: OddsCalibration;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function movementScore(quality: "strong" | "moderate" | "weak"): number {
  if (quality === "strong") return 1;
  if (quality === "moderate") return 0.65;
  return 0.3;
}

function holdoutFactor(books: FairOutcomeBook[]): number {
  const actionable = books.filter((book) => book.staleActionable).length;
  if (actionable === 1) return 1;
  if (actionable === 2) return 0.65;
  if (actionable > 2) return 0.4;
  return 0.15;
}

export function assessTimingSignal(params: TimingParams): TimingSignal {
  const calibration = params.calibration ?? getOddsCalibration();
  const reasons: string[] = [];

  if (params.confidence.historyQuality < calibration.timing.thresholds.weakHistoryQuality) {
    return {
      label: "Weak timing signal",
      urgencyScore: 0.2,
      reasons: ["Movement history is sparse, so timing confidence is limited"]
    };
  }

  const movementStrength = movementScore(params.movementQuality);
  const holdout = holdoutFactor(params.books);
  const freshness = params.confidence.freshnessScore;

  const urgencyScore = clamp01(
    calibration.timing.weights.staleStrength * params.staleStrength +
      calibration.timing.weights.confidence * params.confidence.score +
      calibration.timing.weights.movementStrength * movementStrength +
      calibration.timing.weights.holdoutFactor * holdout +
      calibration.timing.weights.freshness * freshness
  );

  if (params.staleStrength >= 0.6) {
    reasons.push("Actionable stale signal is elevated");
  }
  if (params.movedBooks >= calibration.timing.thresholds.convergingBooksMoved) {
    reasons.push("Multiple books have moved recently");
  }
  if (holdout >= 0.9) {
    reasons.push("Only one stale holdout book remains");
  }
  if (params.confidence.freshnessScore >= 0.7) {
    reasons.push("Quotes are fresh enough for timing interpretation");
  }

  if (holdout >= 0.9 && urgencyScore >= calibration.timing.thresholds.singleHoldoutUrgency) {
    return {
      label: "Single-book holdout",
      urgencyScore,
      reasons: reasons.length ? reasons : ["Only one lagging book remains off consensus"]
    };
  }

  if (urgencyScore >= calibration.timing.thresholds.likelyClosingUrgency && params.staleStrength >= 0.6) {
    return {
      label: "Likely closing",
      urgencyScore,
      reasons: reasons.length ? reasons : ["Strong stale signal with broad movement support"]
    };
  }

  if (
    params.movedBooks >= calibration.timing.thresholds.convergingBooksMoved &&
    urgencyScore >= calibration.timing.thresholds.convergingUrgency
  ) {
    return {
      label: "Market converging",
      urgencyScore,
      reasons: reasons.length ? reasons : ["Book prices are moving toward consensus"]
    };
  }

  if (urgencyScore <= calibration.timing.thresholds.stableUrgencyMax && params.confidence.score >= 0.6) {
    return {
      label: "Stable for now",
      urgencyScore,
      reasons: reasons.length ? reasons : ["No strong close-pressure signal detected"]
    };
  }

  return {
    label: "Weak timing signal",
    urgencyScore,
    reasons: reasons.length ? reasons : ["Timing inputs are mixed across books"]
  };
}
