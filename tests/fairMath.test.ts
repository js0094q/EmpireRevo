import test from "node:test";
import assert from "node:assert/strict";
import {
  americanFromProb,
  americanToRawImpliedProbability,
  devigTwoWay,
  impliedProbFromAmerican,
  removeVigWithinGroup,
  weightedFairProbability
} from "../lib/server/odds/fairMath";

test("implied probability from American odds", () => {
  assert.ok(Math.abs(impliedProbFromAmerican(-110) - 0.5238095238) < 1e-6);
  assert.ok(Math.abs(impliedProbFromAmerican(110) - 0.4761904761) < 1e-6);
});

test("raw implied probability excludes invalid odds", () => {
  assert.equal(americanToRawImpliedProbability(0), null);
  assert.equal(americanToRawImpliedProbability(Number.NaN), null);
  assert.ok(Math.abs((americanToRawImpliedProbability(-110) ?? 0) - 0.5238095238) < 1e-6);
});

test("proportional two-way devig is balanced for -110/-110", () => {
  const p1 = impliedProbFromAmerican(-110);
  const p2 = impliedProbFromAmerican(-110);
  const noVig = devigTwoWay(p1, p2);

  if (noVig.p1NoVig === null || noVig.p2NoVig === null) {
    assert.fail("balanced two-way devig should return probabilities");
  }
  assert.ok(Math.abs(noVig.p1NoVig - 0.5) < 1e-9);
  assert.ok(Math.abs(noVig.p2NoVig - 0.5) < 1e-9);
});

test("convert probability to American odds", () => {
  assert.equal(americanFromProb(0.5), -100);
  assert.equal(americanFromProb(0.4), 150);
  assert.equal(americanFromProb(0.6), -150);
});

test("weighted fair probability emphasizes higher weights", () => {
  const fair = weightedFairProbability([
    { probability: 0.6, weight: 1 },
    { probability: 0.4, weight: 3 }
  ]);
  if (fair === null) assert.fail("weighted average should be defined");
  assert.ok(Math.abs(fair - 0.45) < 1e-9);
});

test("weighted fair probability falls back to neutral without explicit unweighted fallback", () => {
  const fair = weightedFairProbability([
    { probability: 0.7, weight: 0 },
    { probability: 0.3, weight: 0 }
  ]);
  assert.equal(fair, null);
});

test("weighted fair probability can use unweighted fallback when explicitly enabled", () => {
  const fair = weightedFairProbability(
    [
      { probability: 0.8, weight: 0 },
      { probability: 0.4, weight: 0 }
    ],
    { allowUnweightedFallback: true }
  );
  if (fair === null) assert.fail("unweighted fallback should be defined");
  assert.ok(Math.abs(fair - 0.6) < 1e-9);
});

test("remove vig preserves invalid entries as null", () => {
  const adjusted = removeVigWithinGroup([0.5238095238, null]);
  assert.equal(adjusted[0] !== null, true);
  assert.equal(adjusted[1], null);
});
