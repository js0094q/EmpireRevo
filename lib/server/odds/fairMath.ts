function clampProbability(value: number, fallback = 0.5): number {
  if (!Number.isFinite(value)) return fallback;
  if (value <= 0) return 0.001;
  if (value >= 1) return 0.999;
  return value;
}

/**
 * Convert American odds to raw implied probability.
 * Invalid or zero odds return null so callers can exclude them explicitly.
 */
export function americanToRawImpliedProbability(odds: number): number | null {
  if (!Number.isFinite(odds) || odds === 0) return null;
  if (odds < 0) return -odds / (-odds + 100);
  return 100 / (odds + 100);
}

/**
 * Legacy compatibility wrapper that preserves the old numeric return type.
 * New math paths should prefer `americanToRawImpliedProbability`.
 */
export function americanToProbability(odds: number): number {
  return americanToRawImpliedProbability(odds) ?? 0;
}

/**
 * Convert American odds to decimal payout multiplier (stake included).
 * Invalid or zero odds return null so callers can exclude them explicitly.
 */
export function americanToDecimalOrNull(odds: number): number | null {
  if (!Number.isFinite(odds) || odds === 0) return null;
  if (odds > 0) {
    return 1 + odds / 100;
  }
  return 1 + 100 / Math.abs(odds);
}

export function americanToDecimal(odds: number): number {
  return americanToDecimalOrNull(odds) ?? 0;
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
 * Invalid entries stay null so callers can exclude them downstream.
 */
export function removeVigWithinGroup(probabilities: Array<number | null | undefined>): Array<number | null> {
  if (!probabilities.length) return [];

  const valid = probabilities.filter((prob): prob is number => typeof prob === "number" && Number.isFinite(prob) && prob > 0);
  const total = valid.reduce((sum, prob) => sum + prob, 0);
  const validCount = valid.length;

  if (total > 0) {
    return probabilities.map((prob) => {
      if (typeof prob !== "number" || !Number.isFinite(prob) || prob <= 0) return null;
      return prob / total;
    });
  }

  if (validCount >= 2) {
    const equalShare = 1 / validCount;
    return probabilities.map((prob) => (typeof prob === "number" && Number.isFinite(prob) && prob > 0 ? equalShare : null));
  }

  return probabilities.map(() => null);
}

/**
 * Weighted average of de-vig probabilities.
 * Returns null when there are no valid weighted inputs.
 */
export function weightedFairProbability(
  entries: Array<{ probability: number | null | undefined; weight?: number }>,
  options?: { allowUnweightedFallback?: boolean }
): number | null {
  if (!entries.length) return null;
  let weighted = 0;
  let totalWeight = 0;
  let validEntries = 0;
  for (const entry of entries) {
    const probability = entry.probability;
    if (typeof probability !== "number" || !Number.isFinite(probability) || probability <= 0 || probability >= 1) continue;
    const weight = Number.isFinite(entry.weight) ? Math.max(0, entry.weight as number) : 0;
    if (weight <= 0) continue;
    const prob = clampProbability(probability, 0.5);
    weighted += prob * weight;
    totalWeight += weight;
    validEntries += 1;
  }
  if (totalWeight <= 0 || validEntries <= 0) {
    if (options?.allowUnweightedFallback) {
      const valid = entries.filter(
        (entry): entry is { probability: number; weight?: number } =>
          typeof entry.probability === "number" &&
          Number.isFinite(entry.probability) &&
          entry.probability > 0 &&
          entry.probability < 1
      );
      if (!valid.length) return null;
      const avg = valid.reduce((sum, entry) => sum + clampProbability(entry.probability, 0.5), 0);
      return avg / valid.length;
    }
    return null;
  }
  return weighted / totalWeight;
}

export function impliedProbFromAmerican(a: number): number {
  return americanToProbability(a);
}

export function americanFromProb(p: number): number {
  return probabilityToAmerican(p);
}

export function devigTwoWay(p1: number, p2: number): { p1NoVig: number | null; p2NoVig: number | null } {
  const normalized = removeVigWithinGroup([p1, p2]);
  return {
    p1NoVig: normalized[0] ?? null,
    p2NoVig: normalized[1] ?? null
  };
}

export function edgePct(fairProb: number, bookProbNoVig: number): number {
  const fair = clampProbability(fairProb, 0.5);
  const book = clampProbability(bookProbNoVig, 0.5);
  return (fair - book) * 100;
}
