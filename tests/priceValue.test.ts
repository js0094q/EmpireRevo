import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPriceVsFairExplanation,
  buildPriceVsFairMetrics,
  classifyOpportunityStrength,
  compareAmericanPriceToFair,
  computeActionableValueScore,
  deriveRecommendationBadge,
  type PriceValueDirection
} from "../lib/odds/priceValue";

function directionFor(marketPrice: number, fairPrice: number): PriceValueDirection {
  return compareAmericanPriceToFair(marketPrice, fairPrice).direction;
}

test("compareAmericanPriceToFair handles positive odds correctly", () => {
  assert.equal(directionFor(135, 133), "better_than_fair");
});

test("compareAmericanPriceToFair handles worse favorite prices correctly", () => {
  assert.equal(directionFor(-800, -682), "worse_than_fair");
});

test("compareAmericanPriceToFair handles better favorite prices correctly", () => {
  assert.equal(directionFor(-650, -682), "better_than_fair");
});

test("buildPriceVsFairExplanation avoids favorable language for worse favorite prices", () => {
  const metrics = buildPriceVsFairMetrics({
    marketPriceAmerican: -800,
    fairPriceAmerican: -682
  });
  const text = buildPriceVsFairExplanation({
    marketPriceAmerican: metrics.marketPriceAmerican,
    fairPriceAmerican: metrics.fairPriceAmerican,
    marketImpliedProb: metrics.marketImpliedProb,
    fairImpliedProb: metrics.fairImpliedProb,
    direction: metrics.priceValueDirection,
    favoriteStatus: "favorite"
  });

  assert.doesNotMatch(text, /favorable pricing/i);
  assert.doesNotMatch(text, /better price than fair/i);
  assert.doesNotMatch(text, /best value/i);
  assert.match(text, /charging more juice/i);
});

test("buildPriceVsFairExplanation calls out better underdog price", () => {
  const metrics = buildPriceVsFairMetrics({
    marketPriceAmerican: 135,
    fairPriceAmerican: 133
  });
  const text = buildPriceVsFairExplanation({
    marketPriceAmerican: metrics.marketPriceAmerican,
    fairPriceAmerican: metrics.fairPriceAmerican,
    marketImpliedProb: metrics.marketImpliedProb,
    fairImpliedProb: metrics.fairImpliedProb,
    direction: metrics.priceValueDirection,
    favoriteStatus: "underdog"
  });

  assert.match(text, /better price than fair/i);
});

test("Atlanta-like moderate underdog is better than fair but not auto best value", () => {
  const direction = compareAmericanPriceToFair(115, 110).direction;
  const strength = classifyOpportunityStrength({
    marketPrice: 115,
    fairPrice: 110,
    marketImpliedProb: 0.4417,
    fairImpliedProb: 0.4770,
    probabilityGapPctPoints: -3.53,
    priceValueDirection: direction
  });
  const badge = deriveRecommendationBadge({
    priceValueDirection: direction,
    strength
  });
  assert.equal(direction, "better_than_fair");
  assert.notEqual(badge, "best_value");
  assert.ok(badge === "better_than_fair" || badge === "model_lean");
});

test("Wizards-like extreme longshot is longshot price advantage, not best value", () => {
  const direction = compareAmericanPriceToFair(950, 848).direction;
  const strength = classifyOpportunityStrength({
    marketPrice: 950,
    fairPrice: 848,
    marketImpliedProb: 0.09,
    fairImpliedProb: 0.1053,
    probabilityGapPctPoints: -1.53,
    priceValueDirection: direction
  });
  const badge = deriveRecommendationBadge({
    priceValueDirection: direction,
    strength
  });
  const text = buildPriceVsFairExplanation({
    marketPriceAmerican: 950,
    fairPriceAmerican: 848,
    marketImpliedProb: 0.09,
    fairImpliedProb: 0.1053,
    direction,
    strength,
    favoriteStatus: "underdog"
  });

  assert.equal(direction, "better_than_fair");
  assert.equal(strength, "longshot_thin");
  assert.equal(badge, "longshot_price_advantage");
  assert.doesNotMatch(text, /best value/i);
  assert.match(text, /longshot|thin/i);
});

test("strong better-than-fair signal can be promoted to best value", () => {
  const direction = compareAmericanPriceToFair(150, 120).direction;
  const score = computeActionableValueScore({
    marketPrice: 150,
    fairPrice: 120,
    marketImpliedProb: 0.4,
    fairImpliedProb: 0.455,
    probabilityGapPctPoints: -5.5,
    priceValueDirection: direction
  });
  const strength = classifyOpportunityStrength({
    marketPrice: 150,
    fairPrice: 120,
    marketImpliedProb: 0.4,
    fairImpliedProb: 0.455,
    probabilityGapPctPoints: -5.5,
    priceValueDirection: direction
  });
  const badge = deriveRecommendationBadge({
    priceValueDirection: direction,
    strength
  });

  assert.equal(direction, "better_than_fair");
  assert.ok(score >= 7);
  assert.equal(strength, "strong");
  assert.equal(badge, "best_value");
});

test("worse favorite price can never be best value", () => {
  const direction = compareAmericanPriceToFair(-800, -682).direction;
  const strength = classifyOpportunityStrength({
    marketPrice: -800,
    fairPrice: -682,
    marketImpliedProb: 0.8889,
    fairImpliedProb: 0.8721,
    probabilityGapPctPoints: 1.68,
    priceValueDirection: direction
  });
  const badge = deriveRecommendationBadge({
    priceValueDirection: direction,
    strength
  });

  assert.equal(direction, "worse_than_fair");
  assert.notEqual(badge, "best_value");
});
