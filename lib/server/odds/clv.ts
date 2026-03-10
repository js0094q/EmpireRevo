import type { ClvResult } from "@/lib/server/odds/types";
import type { CloseReferenceMethod } from "@/lib/server/odds/types";
import { americanToProbability } from "@/lib/server/odds/fairMath";

function americanOrNull(value: number | null | undefined): number | null {
  if (!Number.isFinite(value)) return null;
  const american = Number(value);
  if (american === 0) return null;
  return american;
}

export function computeClv(params: {
  betPriceAmerican?: number | null;
  closePriceAmerican?: number | null;
  fairAtBetTime?: number | null;
  closeReference?: CloseReferenceMethod;
}): ClvResult {
  const closeReference = params.closeReference || "closing_global_best";
  const bet = americanOrNull(params.betPriceAmerican);
  const close = americanOrNull(params.closePriceAmerican);
  const fairAtBetTime = americanOrNull(params.fairAtBetTime);
  const betImpliedProb = bet !== null ? americanToProbability(bet) : null;
  const closeImpliedProb = close !== null ? americanToProbability(close) : null;
  const clvProbDelta =
    betImpliedProb !== null && closeImpliedProb !== null
      ? closeImpliedProb - betImpliedProb
      : null;
  const beatClose = clvProbDelta !== null ? clvProbDelta > 0 : null;
  const displayAmericanDelta = bet !== null && close !== null ? bet - close : null;

  return {
    betPriceAmerican: bet,
    closePriceAmerican: close,
    fairAtBetTime,
    betImpliedProb,
    closeImpliedProb,
    clvProbDelta,
    beatClose,
    displayAmericanDelta,
    clvAmericanDelta: displayAmericanDelta,
    closeReference
  };
}
