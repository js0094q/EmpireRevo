import { americanToDecimal } from "@/lib/server/odds/fairMath";

function clampFairProbability(probability: number): number {
  if (!Number.isFinite(probability)) return Number.NaN;
  if (probability <= 0) return 0;
  if (probability >= 1) return 1;
  return probability;
}

/**
 * Expected value (EV) expressed as percent return on stake using decimal odds.
 *
 * EV = (fair_prob * decimal_odds) - 1
 * EV% = EV * 100
 */
export function calculateEvPercent(fairProbability: number, americanOdds: number): number {
  const fair = clampFairProbability(fairProbability);
  const decimal = americanToDecimal(americanOdds);
  if (!Number.isFinite(fair) || decimal <= 0) return 0;
  return (fair * decimal - 1) * 100;
}
