function clampProbability(value: number, fallback = 0.5): number {
  if (!Number.isFinite(value)) return fallback;
  if (value <= 0) return 0.001;
  if (value >= 1) return 0.999;
  return value;
}

/**
 * Convert American odds to implied probability.
 */
export function americanToProbability(odds: number): number {
  if (!Number.isFinite(odds) || odds === 0) return 0;
  if (odds < 0) return -odds / (-odds + 100);
  return 100 / (odds + 100);
}

/**
 * Convert American odds to decimal payout multiplier (stake included).
 */
export function americanToDecimal(odds: number): number {
  if (!Number.isFinite(odds) || odds === 0) return 0;
  if (odds > 0) {
    return 1 + odds / 100;
  }
  return 1 + 100 / Math.abs(odds);
}

/**
 * Convert probability to American odds, clamping the inputs to avoid infinities.
 */
export function probabilityToAmerican(probability: number): number {
  const pc = clampProbability(probability);
  if (pc >= 0.5) {
    return Math.round(-(pc / (1 - pc)) * 100);
  }
  return Math.round(((1 - pc) / pc) * 100);
}

/**
 * Remove vig from a list of implied probabilities by normalizing their sum to 1.
 * Falls back to equal weighting when the total probability is invalid.
 */
export function removeVig(probabilities: number[]): number[] {
  if (!probabilities.length) return [];
  const sanitized = probabilities.map((prob) => (Number.isFinite(prob) && prob > 0 ? prob : 0));
  const total = sanitized.reduce((sum, prob) => sum + prob, 0);
  if (total <= 0) {
    const fallback = 1 / probabilities.length;
    return probabilities.map(() => fallback);
  }
  return sanitized.map((prob) => prob / total);
}

/**
 * Weighted average of de-vig probabilities. If all weights are zero we fall back to a simple mean.
 */
export function weightedFairProbability(
  entries: Array<{ probability: number; weight?: number }>,
  options?: { allowUnweightedFallback?: boolean }
): number {
  if (!entries.length) return 0.5;
  let weighted = 0;
  let totalWeight = 0;
  for (const entry of entries) {
    const prob = clampProbability(entry.probability, 0.5);
    const weight = Number.isFinite(entry.weight) ? Math.max(0, entry.weight as number) : 0;
    if (weight > 0) {
      weighted += prob * weight;
      totalWeight += weight;
    }
  }
  if (totalWeight <= 0) {
    if (options?.allowUnweightedFallback) {
      const avg = entries.reduce((sum, entry) => sum + clampProbability(entry.probability, 0.5), 0);
      return avg / entries.length;
    }
    return 0.5;
  }
  return weighted / totalWeight;
}

export function impliedProbFromAmerican(a: number): number {
  return americanToProbability(a);
}

export function americanFromProb(p: number): number {
  return probabilityToAmerican(p);
}

export function devigTwoWay(p1: number, p2: number): { p1NoVig: number; p2NoVig: number } {
  const normalized = removeVig([p1, p2]);
  return {
    p1NoVig: normalized[0] ?? 0.5,
    p2NoVig: normalized[1] ?? 0.5
  };
}

export function edgePct(fairProb: number, bookProbNoVig: number): number {
  const fair = clampProbability(fairProb, 0.5);
  const book = clampProbability(bookProbNoVig, 0.5);
  return (fair - book) * 100;
}
