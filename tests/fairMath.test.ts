import test from "node:test";
import assert from "node:assert/strict";
import { americanFromProb, devigTwoWay, impliedProbFromAmerican } from "../lib/server/odds/fairMath";

test("implied probability from American odds", () => {
  assert.ok(Math.abs(impliedProbFromAmerican(-110) - 0.5238095238) < 1e-6);
  assert.ok(Math.abs(impliedProbFromAmerican(110) - 0.4761904761) < 1e-6);
});

test("proportional two-way devig is balanced for -110/-110", () => {
  const p1 = impliedProbFromAmerican(-110);
  const p2 = impliedProbFromAmerican(-110);
  const noVig = devigTwoWay(p1, p2);

  assert.ok(Math.abs(noVig.p1NoVig - 0.5) < 1e-9);
  assert.ok(Math.abs(noVig.p2NoVig - 0.5) < 1e-9);
});

test("convert probability to American odds", () => {
  assert.equal(americanFromProb(0.5), -100);
  assert.equal(americanFromProb(0.4), 150);
  assert.equal(americanFromProb(0.6), -150);
});
