import test from "node:test";
import assert from "node:assert/strict";
import { getEvPresentation } from "../lib/ui/evPresentation";

test("getEvPresentation maps EV bands without making below-market states warnings", () => {
  assert.deepEqual(getEvPresentation(3.2), { label: "Strong opportunity", tone: "positive" });
  assert.deepEqual(getEvPresentation(1.2), { label: "Attractive edge", tone: "neutral" });
  assert.deepEqual(getEvPresentation(0.2), { label: "Near market", tone: "neutral" });
  assert.deepEqual(getEvPresentation(-0.2), { label: "Market aligned", tone: "neutral" });
  assert.deepEqual(getEvPresentation(-1.2), { label: "Market is less favorable", tone: "neutral" });
  assert.deepEqual(getEvPresentation(-3), { label: "Below consensus", tone: "neutral" });
});
