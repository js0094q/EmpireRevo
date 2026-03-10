export type SportsbookOffer = {
  book: string;
  bookKey: string;
  odds: number;
};

export type BestLine = SportsbookOffer & { payoutMultiplier: number };

function payoutMultiplier(odds: number): number {
  if (!Number.isFinite(odds) || odds === 0) return 0;
  if (odds > 0) {
    return 1 + odds / 100;
  }
  return 1 + 100 / Math.abs(odds);
}

/**
 * Return the sportsbook offering the highest payout for a given side.
 */
export function getBestLine(offers: SportsbookOffer[]): BestLine | null {
  if (!offers.length) return null;
  let best: BestLine | null = null;
  for (const offer of offers) {
    const multiplier = payoutMultiplier(offer.odds);
    if (!best || multiplier > best.payoutMultiplier) {
      best = { ...offer, payoutMultiplier: multiplier };
    }
  }
  return best;
}
