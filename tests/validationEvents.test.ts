import test from "node:test";
import assert from "node:assert/strict";
import {
  getValidationEvents,
  getValidationSinkMode,
  resetValidationEventsForTests,
  setValidationEventSink,
  trackValidationEvent
} from "../lib/server/odds/validationEvents";

test.beforeEach(() => {
  resetValidationEventsForTests();
});

test("validation event snapshot payload stays intact", async () => {
  await trackValidationEvent({
    type: "opportunity_snapshot",
    capturedAt: new Date().toISOString(),
    eventId: "evt-1",
    market: "h2h",
    outcome: "Home",
    commenceTime: new Date().toISOString(),
    score: 74.5,
    edgePct: 1.9,
    fairPriceAmerican: -112,
    confidenceLabel: "High Confidence",
    confidenceScore: 0.81,
    staleFlag: "stale_price",
    staleStrength: 0.73,
    timingLabel: "Likely closing",
    contributingBookCount: 6,
    totalBookCount: 8,
    sharpParticipationPct: 0.42,
    pinnedBestBookKey: null,
    pinnedBestEdgePct: 0,
    pinnedScore: 0,
    bestBookKey: "fanduel",
    bestBookPriceAmerican: -104
  });

  const events = getValidationEvents(5);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.type, "opportunity_snapshot");
  assert.equal(events[0]?.eventId, "evt-1");
  assert.equal(events[0]?.bestBookKey, "fanduel");
});

test("validation tracking does not break when custom sink fails", async () => {
  setValidationEventSink(() => {
    throw new Error("sink unavailable");
  });

  await trackValidationEvent({
    type: "opportunity_snapshot",
    capturedAt: new Date().toISOString(),
    eventId: "evt-2",
    market: "spreads",
    outcome: "Away",
    commenceTime: new Date().toISOString(),
    score: 40,
    edgePct: 0.9,
    fairPriceAmerican: -108,
    confidenceLabel: "Moderate Confidence",
    confidenceScore: 0.59,
    staleFlag: "none",
    staleStrength: 0.3,
    timingLabel: "Stable for now",
    contributingBookCount: 3,
    totalBookCount: 6,
    sharpParticipationPct: 0.2,
    pinnedBestBookKey: null,
    pinnedBestEdgePct: 0,
    pinnedScore: 0,
    bestBookKey: "draftkings",
    bestBookPriceAmerican: -110
  });

  assert.equal(getValidationEvents(5).length, 1);
  assert.equal(getValidationSinkMode(), "custom");
});
