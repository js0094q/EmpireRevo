import test from "node:test";
import assert from "node:assert/strict";
import { detectStaleForBook } from "../lib/server/odds/staleDetection";
import type { FairOutcomeBook } from "../lib/server/odds/types";

function book(partial: Partial<FairOutcomeBook>): FairOutcomeBook {
  return {
    bookKey: partial.bookKey || "book",
    title: partial.title || "Book",
    tier: partial.tier || "mainstream",
    isSharpBook: partial.isSharpBook ?? false,
    weight: partial.weight ?? 1,
    priceAmerican: partial.priceAmerican ?? -110,
    impliedProb: partial.impliedProb ?? 0.52,
    impliedProbNoVig: partial.impliedProbNoVig ?? 0.5,
    edgePct: partial.edgePct ?? 0.3,
    evPct: partial.evPct ?? 0.5,
    evQualified: partial.evQualified ?? true,
    isBestPrice: partial.isBestPrice ?? false,
    point: partial.point,
    lastUpdate: partial.lastUpdate ?? new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    movement: partial.movement
  };
}

test("stale detection flags actionable stale price conservatively", () => {
  const staleTs = new Date(Date.now() - 90 * 60 * 1000).toISOString();
  const rows = detectStaleForBook({
    market: "h2h",
    confidenceScore: 0.72,
    books: [
      book({ bookKey: "pinnacle", isSharpBook: true, tier: "sharp", priceAmerican: -120, edgePct: 0.2, movement: { openPrice: -118, prevPrice: -120, currentPrice: -120, delta: -2, move: 0, updatedAt: new Date().toISOString(), history: [{ ts: new Date(Date.now() - 10_000).toISOString(), priceAmerican: -118 }, { ts: new Date().toISOString(), priceAmerican: -120 }] } }),
      book({ bookKey: "caesars", title: "Caesars", priceAmerican: -122, edgePct: 0.1, movement: { openPrice: -122, prevPrice: -122, currentPrice: -122, delta: 0, move: 0, updatedAt: new Date().toISOString(), history: [{ ts: new Date(Date.now() - 10_000).toISOString(), priceAmerican: -122 }, { ts: new Date().toISOString(), priceAmerican: -122 }] } }),
      book({ bookKey: "fanduel", title: "FanDuel", priceAmerican: -104, edgePct: 1.4, isBestPrice: true, lastUpdate: staleTs, movement: { openPrice: -104, prevPrice: -104, currentPrice: -104, delta: 0, move: 0, updatedAt: staleTs, history: [{ ts: new Date(Date.now() - 10_000).toISOString(), priceAmerican: -104 }, { ts: new Date().toISOString(), priceAmerican: -104 }] } })
    ]
  });
  const fd = rows.find((entry) => entry.bookKey === "fanduel");
  assert.ok(fd);
  assert.ok(["stale_price", "best_market_confirmed", "lagging_book"].includes(fd?.staleFlag || "none"));
});

test("stale detection avoids noisy over-triggering for tiny gaps", () => {
  const rows = detectStaleForBook({
    market: "h2h",
    confidenceScore: 0.65,
    books: [
      book({ bookKey: "a", priceAmerican: -109, edgePct: 0.22 }),
      book({ bookKey: "b", priceAmerican: -110, edgePct: 0.2 }),
      book({ bookKey: "c", priceAmerican: -108, edgePct: 0.18 })
    ]
  });
  assert.ok(rows.every((entry) => (entry.staleFlag || "none") === "none" || entry.staleStrength! < 0.62));
});
