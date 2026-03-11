import test from "node:test";
import assert from "node:assert/strict";
import { resolveRequestedMarket } from "../lib/server/odds/pageData";
import type { MarketAvailability } from "../lib/server/odds/types";

function availabilityFixture(): MarketAvailability[] {
  return [
    {
      market: "h2h",
      status: "active",
      feedEventCount: 4,
      comparableEventCount: 4,
      qualifiedEventCount: 2
    },
    {
      market: "spreads",
      status: "limited",
      feedEventCount: 4,
      comparableEventCount: 1,
      qualifiedEventCount: 0
    },
    {
      market: "totals",
      status: "limited",
      feedEventCount: 2,
      comparableEventCount: 0,
      qualifiedEventCount: 0
    }
  ];
}

test("resolveRequestedMarket keeps a renderable limited market when explicitly requested", () => {
  const resolved = resolveRequestedMarket({
    requestedMarket: "spreads",
    marketAvailability: availabilityFixture()
  });

  assert.equal(resolved.resolvedMarket, "spreads");
  assert.equal(resolved.resolvedStatus, "limited");
});

test("resolveRequestedMarket skips raw-only limited markets in favor of a usable board", () => {
  const resolved = resolveRequestedMarket({
    requestedMarket: "totals",
    marketAvailability: availabilityFixture()
  });

  assert.equal(resolved.resolvedMarket, "h2h");
  assert.equal(resolved.resolvedStatus, "active");
});

test("resolveRequestedMarket falls back to a renderable limited market when nothing is active", () => {
  const resolved = resolveRequestedMarket({
    requestedMarket: "totals",
    marketAvailability: [
      {
        market: "h2h",
        status: "unavailable",
        feedEventCount: 0,
        comparableEventCount: 0,
        qualifiedEventCount: 0
      },
      {
        market: "spreads",
        status: "limited",
        feedEventCount: 3,
        comparableEventCount: 1,
        qualifiedEventCount: 0
      },
      {
        market: "totals",
        status: "limited",
        feedEventCount: 2,
        comparableEventCount: 0,
        qualifiedEventCount: 0
      }
    ]
  });

  assert.equal(resolved.resolvedMarket, "spreads");
  assert.equal(resolved.resolvedStatus, "limited");
});
