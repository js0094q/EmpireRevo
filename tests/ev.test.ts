import test from "node:test";
import assert from "node:assert/strict";
import { calculateEvPercent } from "../lib/server/odds/ev";

test("calculateEvPercent follows the decimal odds EV convention", () => {
  const result = calculateEvPercent(0.52, 110);
  assert.ok(Math.abs(result - 9.2) < 1e-6);
});

test("calculateEvPercent can return negative EV for over-priced odds", () => {
  const result = calculateEvPercent(0.48, -110);
  assert.ok(result < 0);
});

test("calculateEvPercent guards against invalid input", () => {
  assert.equal(calculateEvPercent(0, 110), 0);
  assert.equal(calculateEvPercent(0.5, 0), 0);
  assert.equal(calculateEvPercent(NaN, -120), 0);
});
