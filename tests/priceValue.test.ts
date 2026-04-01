import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPriceVsFairExplanation,
  buildPriceVsFairMetrics,
  compareAmericanPriceToFair,
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
