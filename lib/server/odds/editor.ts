import type { BoardResponse, DerivedGame } from "@/lib/odds/schemas";
import {
  buildPriceVsFairMetrics,
  classifyOpportunityStrength,
  computeActionableValueScore,
  deriveRecommendationBadge
} from "@/lib/odds/priceValue";
import { americanFromProb } from "@/lib/server/odds/fairMath";

function topSide(game: DerivedGame) {
  return game.markets
    .flatMap((market) => market.sides)
    .sort((a, b) => {
      const aFairPrice = americanFromProb(a.fairProb);
      const bFairPrice = americanFromProb(b.fairProb);
      const aMetrics = buildPriceVsFairMetrics({
        marketPriceAmerican: a.bestPrice.price,
        fairPriceAmerican: aFairPrice,
        fairImpliedProb: a.fairProb
      });
      const bMetrics = buildPriceVsFairMetrics({
        marketPriceAmerican: b.bestPrice.price,
        fairPriceAmerican: bFairPrice,
        fairImpliedProb: b.fairProb
      });
      const aStrength = classifyOpportunityStrength({
        marketPrice: aMetrics.marketPriceAmerican,
        fairPrice: aMetrics.fairPriceAmerican,
        marketImpliedProb: aMetrics.marketImpliedProb,
        fairImpliedProb: aMetrics.fairImpliedProb,
        probabilityGapPctPoints: aMetrics.probabilityGapPct,
        priceValueDirection: aMetrics.priceValueDirection
      });
      const bStrength = classifyOpportunityStrength({
        marketPrice: bMetrics.marketPriceAmerican,
        fairPrice: bMetrics.fairPriceAmerican,
        marketImpliedProb: bMetrics.marketImpliedProb,
        fairImpliedProb: bMetrics.fairImpliedProb,
        probabilityGapPctPoints: bMetrics.probabilityGapPct,
        priceValueDirection: bMetrics.priceValueDirection
      });
      const aBadge = deriveRecommendationBadge({
        priceValueDirection: aMetrics.priceValueDirection,
        strength: aStrength
      });
      const bBadge = deriveRecommendationBadge({
        priceValueDirection: bMetrics.priceValueDirection,
        strength: bStrength
      });
      const aScore = computeActionableValueScore({
        marketPrice: aMetrics.marketPriceAmerican,
        fairPrice: aMetrics.fairPriceAmerican,
        marketImpliedProb: aMetrics.marketImpliedProb,
        fairImpliedProb: aMetrics.fairImpliedProb,
        probabilityGapPctPoints: aMetrics.probabilityGapPct,
        priceValueDirection: aMetrics.priceValueDirection
      }) + (aBadge === "best_value" ? 4 : aBadge === "longshot_price_advantage" ? -3 : 0);
      const bScore = computeActionableValueScore({
        marketPrice: bMetrics.marketPriceAmerican,
        fairPrice: bMetrics.fairPriceAmerican,
        marketImpliedProb: bMetrics.marketImpliedProb,
        fairImpliedProb: bMetrics.fairImpliedProb,
        probabilityGapPctPoints: bMetrics.probabilityGapPct,
        priceValueDirection: bMetrics.priceValueDirection
      }) + (bBadge === "best_value" ? 4 : bBadge === "longshot_price_advantage" ? -3 : 0);
      return bScore - aScore || b.evPct - a.evPct;
    })[0];
}

export function buildEditorNote(params: {
  comingUp: DerivedGame[];
  bestValueNow: DerivedGame[];
  feedCount: number;
}): BoardResponse["editorNote"] {
  const { comingUp, bestValueNow, feedCount } = params;
  const firstUpcoming = comingUp[0];
  const topGame = bestValueNow[0];
  const topSignal = topGame ? topSide(topGame) : undefined;

  const firstLabel = firstUpcoming
    ? `${firstUpcoming.event.away.name} at ${firstUpcoming.event.home.name}`
    : "No marquee games in the next 24 hours";

  const signalLabel = topGame && topSignal
    ? `${topGame.event.away.name} at ${topGame.event.home.name} (${topSignal.label} ${topSignal.evPct.toFixed(1)}% EV)`
    : "No high-confidence model dislocation currently stands out";

  return {
    headline: "Live Market Brief",
    body: `Market pressure remains active across books. ${firstLabel} is up next, while ${signalLabel} carries the strongest weighted signal right now.`,
    watchlist: [
      feedCount > 0
        ? `Track rapid move alerts before entry; ${feedCount} notable events are active.`
        : "Watch for fresh movement as books refresh toward kickoff.",
      "Prioritize spots where sharp-weighted lean exceeds 2.0 percentage points."
    ],
    lockLike: [
      "Highest Confidence setup only when variance is low, recency is fresh, and multi-book alignment persists."
    ]
  };
}

export const BOARD_DISCLAIMER =
  "Market-based pricing, not predictions. All values are derived from real sportsbook data, adjusted for margin, and compared to fair market probability. Price vs Fair measures payout quality, while Probability Gap measures model disagreement.";
