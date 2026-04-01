import type { MarketKey } from "@/lib/odds/schemas";
import { getOddsCalibration, type OddsCalibration } from "@/lib/server/odds/calibration";
import { americanToProbability } from "@/lib/server/odds/fairMath";
import type { FairOutcomeBook, StaleFlag } from "@/lib/server/odds/types";

export type StaleAssessment = {
  staleStrength: number;
  staleFlag: StaleFlag;
  summary: string;
  consensusGapPct: number;
  actionable: boolean;
};

type DetectParams = {
  market: MarketKey;
  confidenceScore: number;
  books: FairOutcomeBook[];
  nowMs?: number;
  calibration?: OddsCalibration;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function impliedProbability(book: FairOutcomeBook): number {
  const fromPrice = americanToProbability(book.priceAmerican);
  if (fromPrice > 0) return fromPrice;
  if (Number.isFinite(book.impliedProb) && book.impliedProb > 0 && book.impliedProb < 1) {
    return Number(book.impliedProb);
  }
  return 0;
}

function consensusImpliedProbability(books: FairOutcomeBook[]): number {
  const sorted = books.map((book) => impliedProbability(book)).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  return sorted[Math.floor(sorted.length / 2)] ?? sorted[0] ?? 0;
}

function consensusGapPct(book: FairOutcomeBook, medianImpliedProb: number): number {
  if (!Number.isFinite(medianImpliedProb) || medianImpliedProb <= 0 || medianImpliedProb >= 1) return 0;
  const bookImpliedProb = impliedProbability(book);
  if (!Number.isFinite(bookImpliedProb) || bookImpliedProb <= 0 || bookImpliedProb >= 1) return 0;
  // Positive values mean this book implies a higher win probability than market consensus.
  return (bookImpliedProb - medianImpliedProb) * 100;
}

function movementGap(book: FairOutcomeBook, sharpAvgMove: number): number {
  const ownMove = book.movement?.move ?? 0;
  return sharpAvgMove - ownMove;
}

function staleAgeScore(book: FairOutcomeBook, nowMs: number, calibration: OddsCalibration): number {
  if (!book.lastUpdate) return calibration.confidence.fallbackScores.missingFreshness;
  const ageMs = nowMs - Date.parse(book.lastUpdate);
  if (!Number.isFinite(ageMs)) return calibration.confidence.fallbackScores.missingFreshness;

  const freshMs = calibration.stale.age.freshMinutes * 60 * 1000;
  const staleMs = calibration.stale.age.staleMinutes * 60 * 1000;

  if (ageMs <= freshMs) return 0.05;
  if (ageMs >= staleMs) return 1;
  return clamp01((ageMs - freshMs) / (staleMs - freshMs));
}

function isMarketConfirmed(book: FairOutcomeBook, confidenceScore: number, calibration: OddsCalibration): boolean {
  const sharpMove = Math.abs(book.movement?.move ?? 0) >= calibration.stale.thresholds.marketConfirmedSharpMove;
  return (
    book.edgePct > calibration.stale.thresholds.marketConfirmedEdgePct &&
    confidenceScore >= calibration.stale.thresholds.marketConfirmedConfidence &&
    sharpMove
  );
}

export function detectStaleForBook(params: DetectParams): FairOutcomeBook[] {
  if (!params.books.length) return params.books;

  const calibration = params.calibration ?? getOddsCalibration();
  const nowMs = params.nowMs ?? Date.now();
  const medianImpliedProb = consensusImpliedProbability(params.books);
  const sharpMoves = params.books.filter((book) => book.isSharpBook).map((book) => book.movement?.move ?? 0);
  const sharpAvgMove = mean(sharpMoves);
  const scale = calibration.stale.marketScale[params.market];
  const evidenceWeightTotal =
    calibration.stale.componentWeights.age +
    calibration.stale.componentWeights.movement +
    calibration.stale.componentWeights.consensusGap;

  return params.books.map((book) => {
    const gapPct = consensusGapPct(book, medianImpliedProb);
    const ownMovementGap = movementGap(book, sharpAvgMove);
    const edgeSignal = clamp01(Math.max(0, book.edgePct) / calibration.stale.scaling.edgePctMax);
    const ageSignal = staleAgeScore(book, nowMs, calibration);
    const moveSignal = clamp01(Math.abs(ownMovementGap) / calibration.stale.scaling.movementGapMax);
    const consensusSignal = clamp01(Math.abs(gapPct) / calibration.stale.scaling.consensusGapMax);

    const evidenceStrength =
      evidenceWeightTotal > 0
        ? (calibration.stale.componentWeights.age * ageSignal +
            calibration.stale.componentWeights.movement * moveSignal +
            calibration.stale.componentWeights.consensusGap * consensusSignal) /
          evidenceWeightTotal
        : 0;
    const staleStrength = clamp01(scale * evidenceStrength);

    let staleFlag: StaleFlag = "none";
    let summary = "In line with market";
    let actionable = false;
    const reasons: string[] = [];

    if (book.isBestPrice && isMarketConfirmed(book, params.confidenceScore, calibration)) {
      staleFlag = "best_market_confirmed";
      summary = "Best available and market-confirmed";
      actionable = true;
      reasons.push("best_line", "market_confirmed");
    } else if (
      book.isBestPrice &&
      book.edgePct > 0 &&
      (book.movement?.move ?? 0) < calibration.stale.thresholds.movingAgainstMove
    ) {
      staleFlag = "best_moving_against";
      summary = "Best available, but moving against market";
      reasons.push("best_line", "moving_against");
    } else if (
      staleStrength >= calibration.stale.thresholds.stalePriceStrength &&
      book.edgePct > calibration.stale.thresholds.stalePriceEdgePct &&
      params.confidenceScore >= calibration.stale.thresholds.staleConfidenceMin
    ) {
      staleFlag = "stale_price";
      summary = "Stale price";
      actionable = true;
      reasons.push("stale_strength", "edge", "confidence");
    } else if (
      staleStrength >= calibration.stale.thresholds.laggingStrength &&
      ownMovementGap > calibration.stale.thresholds.laggingMovementGap &&
      book.edgePct > calibration.stale.thresholds.laggingEdgePct
    ) {
      staleFlag = "lagging_book";
      summary = "Lagging book";
      actionable = true;
      reasons.push("lagging_move", "edge");
    } else if (
      staleStrength >= calibration.stale.thresholds.offMarketStrength &&
      params.confidenceScore < calibration.stale.thresholds.offMarketConfidenceMax &&
      Math.abs(gapPct) > calibration.stale.thresholds.offMarketGapPct
    ) {
      staleFlag = "off_market";
      summary = "Off-market outlier";
      actionable = false;
      reasons.push("off_market_gap", "low_confidence");
    }

    return {
      ...book,
      staleStrength,
      staleFlag,
      staleSummary: summary,
      consensusGapPct: gapPct,
      staleActionable: actionable,
      staleReasons: reasons,
      staleDiagnostics: {
        marketScale: scale,
        evidenceStrength,
        edgeSignal,
        ageSignal,
        movementSignal: moveSignal,
        consensusSignal,
        confidenceScore: params.confidenceScore,
        consensusGapPct: gapPct,
        movementGap: ownMovementGap,
        thresholds: {
          stalePriceStrength: calibration.stale.thresholds.stalePriceStrength,
          laggingStrength: calibration.stale.thresholds.laggingStrength,
          offMarketStrength: calibration.stale.thresholds.offMarketStrength
        }
      }
    };
  });
}
