import test from "node:test";
import assert from "node:assert/strict";
import { computeClv } from "../lib/server/odds/clv";
import { americanToProbability } from "../lib/server/odds/fairMath";

function almostEqual(actual: number | null | undefined, expected: number): void {
  assert.ok(Number.isFinite(actual));
  assert.ok(Math.abs(Number(actual) - expected) < 1e-12);
}

test("CLV uses implied probability space for negative American odds", () => {
  const betterThanClose = computeClv({
    betPriceAmerican: -110,
    closePriceAmerican: -120,
    closeReference: "closing_global_best"
  });
  const worseThanClose = computeClv({
    betPriceAmerican: -120,
    closePriceAmerican: -110,
    closeReference: "closing_global_best"
  });

  almostEqual(betterThanClose.betImpliedProb, americanToProbability(-110));
  almostEqual(betterThanClose.closeImpliedProb, americanToProbability(-120));
  assert.ok((betterThanClose.clvProbDelta || 0) > 0);
  assert.equal(betterThanClose.beatClose, true);

  assert.ok((worseThanClose.clvProbDelta || 0) < 0);
  assert.equal(worseThanClose.beatClose, false);
});

test("CLV uses implied probability space for positive American odds", () => {
  const betterThanClose = computeClv({
    betPriceAmerican: 120,
    closePriceAmerican: 110,
    closeReference: "closing_global_best"
  });
  const worseThanClose = computeClv({
    betPriceAmerican: 110,
    closePriceAmerican: 120,
    closeReference: "closing_global_best"
  });

  assert.ok((betterThanClose.clvProbDelta || 0) > 0);
  assert.equal(betterThanClose.beatClose, true);

  assert.ok((worseThanClose.clvProbDelta || 0) < 0);
  assert.equal(worseThanClose.beatClose, false);
});

test("CLV exposes display-only American delta for backward compatibility", () => {
  const result = computeClv({
    betPriceAmerican: 110,
    closePriceAmerican: 100,
    closeReference: "closing_pinned_best"
  });

  assert.equal(result.displayAmericanDelta, 10);
  assert.equal(result.clvAmericanDelta, 10);
  assert.equal(result.closeReference, "closing_pinned_best");
});

test("CLV is null-safe for missing or malformed prices", () => {
  const missingClose = computeClv({
    betPriceAmerican: -105,
    closePriceAmerican: null,
    fairAtBetTime: -108,
    closeReference: "closing_global_best"
  });
  const malformed = computeClv({
    betPriceAmerican: 0,
    closePriceAmerican: Number.NaN,
    closeReference: "closing_global_best"
  });

  assert.equal(missingClose.clvProbDelta, null);
  assert.equal(missingClose.beatClose, null);
  assert.equal(missingClose.fairAtBetTime, -108);

  assert.equal(malformed.betImpliedProb, null);
  assert.equal(malformed.closeImpliedProb, null);
  assert.equal(malformed.clvProbDelta, null);
  assert.equal(malformed.beatClose, null);
});
