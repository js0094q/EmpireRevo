import test from "node:test";
import assert from "node:assert/strict";
import { assessConfidence } from "../lib/server/odds/confidence";
import type { FairOutcomeBook } from "../lib/server/odds/types";

function makeBook(partial: Partial<FairOutcomeBook> = {}): FairOutcomeBook {
  return {
    bookKey: partial.bookKey || "book",
    title: partial.title || "Book",
    tier: partial.tier || "mainstream",
    isSharpBook: partial.isSharpBook ?? false,
    weight: partial.weight ?? 1,
    priceAmerican: partial.priceAmerican ?? -110,
    impliedProb: partial.impliedProb ?? 0.5238,
    impliedProbNoVig: partial.impliedProbNoVig ?? 0.5,
    edgePct: partial.edgePct ?? 0.6,
    evPct: partial.evPct ?? 1.5,
    evQualified: partial.evQualified ?? true,
    isBestPrice: partial.isBestPrice ?? false,
    lastUpdate: partial.lastUpdate ?? new Date().toISOString(),
    movement: partial.movement
  };
}

test("assessConfidence rates broad sharp coverage higher", () => {
  const now = Date.now();
  const books = [
    makeBook({ bookKey: "pinnacle", isSharpBook: true, tier: "sharp", impliedProbNoVig: 0.51, movement: { openPrice: -110, prevPrice: -109, currentPrice: -108, delta: 2, move: 1, updatedAt: new Date(now).toISOString(), history: [{ ts: new Date(now - 60_000).toISOString(), priceAmerican: -110 }, { ts: new Date(now).toISOString(), priceAmerican: -108 }] } }),
    makeBook({ bookKey: "circa", isSharpBook: true, tier: "sharp", impliedProbNoVig: 0.509, movement: { openPrice: -110, prevPrice: -109, currentPrice: -109, delta: 1, move: 0, updatedAt: new Date(now).toISOString(), history: [{ ts: new Date(now - 60_000).toISOString(), priceAmerican: -110 }, { ts: new Date(now).toISOString(), priceAmerican: -109 }] } }),
    makeBook({ bookKey: "fanduel", impliedProbNoVig: 0.505, movement: { openPrice: -110, prevPrice: -109, currentPrice: -109, delta: 1, move: 0, updatedAt: new Date(now).toISOString(), history: [{ ts: new Date(now - 60_000).toISOString(), priceAmerican: -110 }, { ts: new Date(now).toISOString(), priceAmerican: -109 }] } })
  ];

  const high = assessConfidence({
    books,
    contributingBooks: 3,
    totalBooks: 4,
    excludedBooks: [],
    nowMs: now
  });
  assert.ok(high.score > 0.7);
  assert.ok(high.label === "High Confidence" || high.label === "Moderate Confidence");
});

test("assessConfidence penalizes thin stale markets", () => {
  const now = Date.now();
  const staleTs = new Date(now - 2 * 60 * 60 * 1000).toISOString();
  const low = assessConfidence({
    books: [makeBook({ lastUpdate: staleTs, impliedProbNoVig: 0.54, movement: { openPrice: -110, prevPrice: -130, currentPrice: -130, delta: -20, move: 0, updatedAt: staleTs, history: [{ ts: staleTs, priceAmerican: -130 }] } })],
    contributingBooks: 1,
    totalBooks: 5,
    excludedBooks: [{ bookKey: "a", title: "A", reason: "missing_market_or_outcomes" }],
    nowMs: now
  });
  assert.ok(low.score < 0.55);
  assert.ok(low.label === "Thin Market" || low.label === "Stale Market");
});

test("assessConfidence measures history quality without letting it change live confidence", () => {
  const now = Date.now();
  const sparse = assessConfidence({
    books: [
      makeBook({
        bookKey: "a",
        isSharpBook: true,
        tier: "sharp",
        impliedProbNoVig: 0.51,
        movement: {
          openPrice: -110,
          prevPrice: -110,
          currentPrice: -109,
          delta: 1,
          move: 1,
          updatedAt: new Date(now).toISOString(),
          history: [{ ts: new Date(now).toISOString(), priceAmerican: -109 }]
        }
      }),
      makeBook({
        bookKey: "b",
        impliedProbNoVig: 0.508,
        movement: {
          openPrice: -110,
          prevPrice: -110,
          currentPrice: -109,
          delta: 1,
          move: 1,
          updatedAt: new Date(now).toISOString(),
          history: [{ ts: new Date(now).toISOString(), priceAmerican: -109 }]
        }
      })
    ],
    contributingBooks: 2,
    totalBooks: 3,
    excludedBooks: [],
    nowMs: now
  });

  const deep = assessConfidence({
    books: [
      makeBook({
        bookKey: "a",
        isSharpBook: true,
        tier: "sharp",
        impliedProbNoVig: 0.51,
        movement: {
          openPrice: -110,
          prevPrice: -105,
          currentPrice: -103,
          delta: 2,
          move: 7,
          updatedAt: new Date(now).toISOString(),
          history: Array.from({ length: 12 }, (_, idx) => ({
            ts: new Date(now - (12 - idx) * 60_000).toISOString(),
            priceAmerican: -115 + idx
          }))
        }
      }),
      makeBook({
        bookKey: "b",
        impliedProbNoVig: 0.508,
        movement: {
          openPrice: -110,
          prevPrice: -106,
          currentPrice: -104,
          delta: 2,
          move: 6,
          updatedAt: new Date(now).toISOString(),
          history: Array.from({ length: 12 }, (_, idx) => ({
            ts: new Date(now - (12 - idx) * 60_000).toISOString(),
            priceAmerican: -114 + idx
          }))
        }
      })
    ],
    contributingBooks: 2,
    totalBooks: 3,
    excludedBooks: [],
    nowMs: now
  });

  assert.ok(sparse.historyQuality < deep.historyQuality);
  assert.equal(sparse.score, deep.score);
  assert.equal(sparse.label, deep.label);
});
