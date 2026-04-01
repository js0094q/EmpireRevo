export type PriceValueDirection = "better_than_fair" | "worse_than_fair" | "near_fair";

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
  probabilityGapPct: number;
  priceValueDirection: PriceValueDirection;
};

type PriceVsFairExplanationParams = {
  marketPriceAmerican: number;
  fairPriceAmerican: number;
  marketImpliedProb: number;
  fairImpliedProb: number;
  direction: PriceValueDirection;
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

  return {
    fairPriceAmerican: params.fairPriceAmerican,
    marketPriceAmerican: params.marketPriceAmerican,
    priceDeltaAmerican: comparison.delta,
    marketImpliedProb,
    fairImpliedProb,
    probabilityGapPct: (marketImpliedProb - fairImpliedProb) * 100,
    priceValueDirection: comparison.direction
  };
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
    return `Probability gap: ${formatProbabilityGap(probabilityGapPct)} (market implied above fair implied).`;
  }
  return `Probability gap: ${formatProbabilityGap(probabilityGapPct)} (market implied below fair implied).`;
}

export function buildPriceVsFairExplanation(params: PriceVsFairExplanationParams): string {
  const market = formatAmericanPrice(params.marketPriceAmerican);
  const fair = formatAmericanPrice(params.fairPriceAmerican);
  const probabilityGapPct = (params.marketImpliedProb - params.fairImpliedProb) * 100;

  if (params.direction === "better_than_fair") {
    return `Available at ${market} versus fair ${fair}. This is a better price than fair. ${describeProbabilityGap(probabilityGapPct)}`;
  }

  if (params.direction === "worse_than_fair") {
    if (params.favoriteStatus === "favorite") {
      return `Available at ${market} versus fair ${fair}. The market is charging more juice than model fair value. ${describeProbabilityGap(probabilityGapPct)}`;
    }
    return `Available at ${market} versus fair ${fair}. The available payout is worse than fair. ${describeProbabilityGap(probabilityGapPct)}`;
  }

  return `Available at ${market} versus fair ${fair}. Available price is close to model fair value. ${describeProbabilityGap(probabilityGapPct)}`;
}
