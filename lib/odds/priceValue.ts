export type PriceValueDirection = "better_than_fair" | "worse_than_fair" | "near_fair";
export type OpportunityStrength = "strong" | "moderate" | "thin" | "longshot_thin";
export type RecommendationBadge = "best_value" | "model_lean" | "better_than_fair" | "longshot_price_advantage" | "none";

type DirectionSummary = {
  direction: PriceValueDirection;
  summary: string;
};

export type PriceComparison = {
  direction: PriceValueDirection;
  delta: number;
  summary: string;
};

export type PriceVsFairMetrics = {
  fairPriceAmerican: number;
  marketPriceAmerican: number;
  priceDeltaAmerican: number;
  marketImpliedProb: number;
  fairImpliedProb: number;
  breakEvenProb: number;
  probabilityGapPct: number;
  priceValueDirection: PriceValueDirection;
};

type PriceVsFairExplanationParams = {
  marketPriceAmerican: number;
  fairPriceAmerican: number;
  marketImpliedProb: number;
  fairImpliedProb: number;
  direction: PriceValueDirection;
  strength?: OpportunityStrength;
  favoriteStatus: "favorite" | "underdog" | "neutral";
};

const DEFAULT_DECIMAL_TOLERANCE = 0.005;

export function americanToImpliedProbability(odds: number): number {
  if (!Number.isFinite(odds) || odds === 0) return 0;
  if (odds < 0) return -odds / (-odds + 100);
  return 100 / (odds + 100);
}

export function americanToDecimal(odds: number): number {
  if (!Number.isFinite(odds) || odds === 0) return 0;
  if (odds > 0) return 1 + odds / 100;
  return 1 + 100 / Math.abs(odds);
}

export function formatAmericanPrice(odds: number): string {
  if (!Number.isFinite(odds)) return "--";
  return odds > 0 ? `+${Math.round(odds)}` : `${Math.round(odds)}`;
}

function summarizeDirection(direction: PriceValueDirection): DirectionSummary {
  if (direction === "better_than_fair") {
    return {
      direction,
      summary: "Market is offering a better price than the model's fair line."
    };
  }
  if (direction === "worse_than_fair") {
    return {
      direction,
      summary: "Market is offering a worse price than the model's fair line."
    };
  }
  return {
    direction,
    summary: "Available price is close to model fair value."
  };
}

export function compareAmericanPriceToFair(
  marketPrice: number,
  fairPrice: number,
  tolerance = DEFAULT_DECIMAL_TOLERANCE
): PriceComparison {
  const delta = marketPrice - fairPrice;
  const marketDecimal = americanToDecimal(marketPrice);
  const fairDecimal = americanToDecimal(fairPrice);

  if (!Number.isFinite(marketDecimal) || !Number.isFinite(fairDecimal) || marketDecimal <= 0 || fairDecimal <= 0) {
    const fallback = summarizeDirection("near_fair");
    return {
      direction: fallback.direction,
      delta,
      summary: fallback.summary
    };
  }

  const decimalDelta = marketDecimal - fairDecimal;
  if (Math.abs(decimalDelta) <= Math.max(0, tolerance)) {
    const near = summarizeDirection("near_fair");
    return {
      direction: near.direction,
      delta,
      summary: near.summary
    };
  }

  if (decimalDelta > 0) {
    const better = summarizeDirection("better_than_fair");
    return {
      direction: better.direction,
      delta,
      summary: better.summary
    };
  }

  const worse = summarizeDirection("worse_than_fair");
  return {
    direction: worse.direction,
    delta,
    summary: worse.summary
  };
}

export function buildPriceVsFairMetrics(params: {
  marketPriceAmerican: number;
  fairPriceAmerican: number;
  marketImpliedProb?: number;
  fairImpliedProb?: number;
  tolerance?: number;
}): PriceVsFairMetrics {
  const comparison = compareAmericanPriceToFair(params.marketPriceAmerican, params.fairPriceAmerican, params.tolerance);
  const impliedFromMarketPrice = americanToImpliedProbability(params.marketPriceAmerican);
  const impliedFromFairPrice = americanToImpliedProbability(params.fairPriceAmerican);
  const marketImpliedProb = Number.isFinite(params.marketImpliedProb) ? Number(params.marketImpliedProb) : impliedFromMarketPrice;
  const fairImpliedProb = Number.isFinite(params.fairImpliedProb) ? Number(params.fairImpliedProb) : impliedFromFairPrice;
  const breakEvenProb = marketImpliedProb;

  return {
    fairPriceAmerican: params.fairPriceAmerican,
    marketPriceAmerican: params.marketPriceAmerican,
    priceDeltaAmerican: comparison.delta,
    marketImpliedProb,
    fairImpliedProb,
    breakEvenProb,
    probabilityGapPct: (fairImpliedProb - breakEvenProb) * 100,
    priceValueDirection: comparison.direction
  };
}

export function computeLineImprovementPct(params: {
  marketPrice: number;
  fairPrice: number;
}): number {
  const marketDecimal = americanToDecimal(params.marketPrice);
  const fairDecimal = americanToDecimal(params.fairPrice);
  if (!Number.isFinite(marketDecimal) || !Number.isFinite(fairDecimal) || marketDecimal <= 0 || fairDecimal <= 0) {
    return 0;
  }
  return ((marketDecimal / fairDecimal) - 1) * 100;
}

export function computeActionableValueScore(input: {
  marketPrice: number;
  fairPrice: number;
  marketImpliedProb: number;
  fairImpliedProb: number;
  probabilityGapPctPoints: number;
  priceValueDirection: PriceValueDirection;
}): number {
  if (input.priceValueDirection !== "better_than_fair") {
    return input.priceValueDirection === "worse_than_fair" ? -3 : 0;
  }

  const lineImprovementPct = Math.max(0, computeLineImprovementPct({ marketPrice: input.marketPrice, fairPrice: input.fairPrice }));
  const gapMagnitude = Math.abs(input.probabilityGapPctPoints);
  let score = lineImprovementPct * 0.8 + gapMagnitude * 0.9;

  // Thin-signal guardrails: a nominally better line still needs practical magnitude.
  if (lineImprovementPct < 1) score -= 2;
  else if (lineImprovementPct < 2) score -= 1;
  if (gapMagnitude < 1) score -= 2;
  else if (gapMagnitude < 2) score -= 1;

  // Longshot penalties prevent huge plus-money prices from auto-dominating the board.
  if (input.fairImpliedProb < 0.2) score -= 1.5;
  if (input.fairImpliedProb < 0.12) score -= 3;
  if (input.fairImpliedProb < 0.08) score -= 4.5;
  if (input.marketPrice >= 500) score -= 1.5;
  if (input.marketPrice >= 800) score -= 2.5;
  if (input.marketPrice >= 1200) score -= 1;

  // Balanced-probability profiles are generally more decision-relevant.
  if (input.fairImpliedProb >= 0.25 && input.fairImpliedProb <= 0.7) score += 0.5;
  if (gapMagnitude >= 4) score += 1;

  return Math.round(score * 100) / 100;
}

export function classifyOpportunityStrength(input: {
  marketPrice: number;
  fairPrice: number;
  marketImpliedProb: number;
  fairImpliedProb: number;
  probabilityGapPctPoints: number;
  priceValueDirection: PriceValueDirection;
}): OpportunityStrength {
  if (input.priceValueDirection !== "better_than_fair") {
    return "thin";
  }

  const lineImprovementPct = Math.max(0, computeLineImprovementPct({ marketPrice: input.marketPrice, fairPrice: input.fairPrice }));
  const gapMagnitude = Math.abs(input.probabilityGapPctPoints);

  // Longshot opportunities require materially higher evidence.
  if (input.fairImpliedProb < 0.08 && (gapMagnitude < 4 || lineImprovementPct < 14)) {
    return "longshot_thin";
  }
  if (input.fairImpliedProb < 0.12 && (gapMagnitude < 3 || lineImprovementPct < 10)) {
    return "longshot_thin";
  }
  if (input.fairImpliedProb < 0.2 && gapMagnitude < 2.5) {
    return "longshot_thin";
  }

  const actionableScore = computeActionableValueScore(input);
  if (actionableScore >= 7) return "strong";
  if (actionableScore >= 4) return "moderate";
  if (input.fairImpliedProb < 0.2) return "longshot_thin";
  return "thin";
}

export function deriveRecommendationBadge(input: {
  priceValueDirection: PriceValueDirection;
  strength: OpportunityStrength;
}): RecommendationBadge {
  if (input.priceValueDirection !== "better_than_fair") {
    return input.priceValueDirection === "worse_than_fair" ? "model_lean" : "none";
  }
  if (input.strength === "strong") return "best_value";
  if (input.strength === "moderate") return "better_than_fair";
  if (input.strength === "longshot_thin") return "longshot_price_advantage";
  return "better_than_fair";
}

export function recommendationBadgeLabel(badge: RecommendationBadge): string {
  if (badge === "best_value") return "Strong Deviation";
  if (badge === "model_lean") return "Model Lean";
  if (badge === "better_than_fair") return "Positive Deviation";
  if (badge === "longshot_price_advantage") return "Longshot Deviation";
  return "Near Fair";
}

function formatProbabilityGap(probabilityGapPct: number): string {
  const rounded = Math.round(probabilityGapPct * 100) / 100;
  const prefix = rounded > 0 ? "+" : "";
  return `${prefix}${rounded.toFixed(2)}pp`;
}

function describeProbabilityGap(probabilityGapPct: number): string {
  if (Math.abs(probabilityGapPct) < 0.01) {
    return "Probability gap is effectively flat.";
  }
  if (probabilityGapPct > 0) {
    return `Probability gap: ${formatProbabilityGap(probabilityGapPct)} (fair implied above break-even).`;
  }
  return `Probability gap: ${formatProbabilityGap(probabilityGapPct)} (fair implied below break-even).`;
}

export function buildPriceVsFairExplanation(params: PriceVsFairExplanationParams): string {
  const market = formatAmericanPrice(params.marketPriceAmerican);
  const fair = formatAmericanPrice(params.fairPriceAmerican);
  const probabilityGapPct =
    (params.fairImpliedProb - americanToImpliedProbability(params.marketPriceAmerican)) * 100;

  if (params.direction === "better_than_fair") {
    if (params.strength === "strong") {
      return `Available at ${market} versus fair ${fair}. This is a better price than fair and a stronger model-dislocation signal. ${describeProbabilityGap(probabilityGapPct)}`;
    }
    if (params.strength === "longshot_thin") {
      return `Available at ${market} versus fair ${fair}. This is a better price than fair, but this remains a longshot profile with thin signal strength. ${describeProbabilityGap(probabilityGapPct)}`;
    }
    if (params.strength === "moderate") {
      return `Available at ${market} versus fair ${fair}. This is a better price than fair with moderate signal strength. ${describeProbabilityGap(probabilityGapPct)}`;
    }
    return `Available at ${market} versus fair ${fair}. This is a better price than fair, but the signal is still thin. ${describeProbabilityGap(probabilityGapPct)}`;
  }

  if (params.direction === "worse_than_fair") {
    if (params.favoriteStatus === "favorite") {
      return `Available at ${market} versus fair ${fair}. The market is charging more juice than model fair value. ${describeProbabilityGap(probabilityGapPct)}`;
    }
    return `Available at ${market} versus fair ${fair}. The available payout is worse than fair. ${describeProbabilityGap(probabilityGapPct)}`;
  }

  return `Available at ${market} versus fair ${fair}. Available price is close to model fair value. ${describeProbabilityGap(probabilityGapPct)}`;
}
