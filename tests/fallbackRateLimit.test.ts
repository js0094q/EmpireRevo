import test from "node:test";
import assert from "node:assert/strict";
import { applyFallbackRateLimit, resetFallbackRateLimitForTests } from "../lib/server/odds/fallbackRateLimit";

test.beforeEach(() => {
  resetFallbackRateLimitForTests();
});

test("fallback limiter blocks when limit is exceeded in the same window", () => {
  const key = "api_fair:127.0.0.1";
  const first = applyFallbackRateLimit({ key, limit: 2, windowSec: 60, nowMs: 1_000 });
  const second = applyFallbackRateLimit({ key, limit: 2, windowSec: 60, nowMs: 1_100 });
  const third = applyFallbackRateLimit({ key, limit: 2, windowSec: 60, nowMs: 1_200 });

  assert.equal(first.success, true);
  assert.equal(first.remaining, 1);
  assert.equal(second.success, true);
  assert.equal(second.remaining, 0);
  assert.equal(third.success, false);
  assert.equal(third.remaining, 0);
});

test("fallback limiter resets after the time window elapses", () => {
  const key = "api_board:127.0.0.1";

  const first = applyFallbackRateLimit({ key, limit: 1, windowSec: 2, nowMs: 1_000 });
  const blocked = applyFallbackRateLimit({ key, limit: 1, windowSec: 2, nowMs: 1_100 });
  const reset = applyFallbackRateLimit({ key, limit: 1, windowSec: 2, nowMs: 3_200 });

  assert.equal(first.success, true);
  assert.equal(blocked.success, false);
  assert.equal(reset.success, true);
  assert.equal(reset.remaining, 0);
});
