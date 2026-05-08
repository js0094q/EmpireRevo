import test from "node:test";
import assert from "node:assert/strict";
import { getEvPresentation } from "../lib/ui/evPresentation";

test("getEvPresentation maps EV bands to neutral and caution tones", () => {
  assert.deepEqual(getEvPresentation(3.2), { label: "Positive edge", tone: "positive" });
  assert.deepEqual(getEvPresentation(1.2), { label: "Small edge", tone: "neutral" });
  assert.deepEqual(getEvPresentation(0.2), { label: "Near market", tone: "neutral" });
  assert.deepEqual(getEvPresentation(-0.2), { label: "Market aligned", tone: "neutral" });
  assert.deepEqual(getEvPresentation(-1.2), { label: "Below market price", tone: "caution" });
  assert.deepEqual(getEvPresentation(-3), { label: "Consensus stronger elsewhere", tone: "caution" });
});

