import test from "node:test";
import assert from "node:assert/strict";
import { summarizeMovementSignal } from "../lib/server/odds/movementSignal";
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
    edgePct: partial.edgePct ?? 0.4,
    evPct: partial.evPct ?? 0.8,
    evQualified: partial.evQualified ?? true,
    isBestPrice: partial.isBestPrice ?? false,
    movement: partial.movement
  };
}

test("movement signal does not report strong quality on thin sharp evidence", () => {
  const signal = summarizeMovementSignal([
    book({
      bookKey: "pinnacle",
      isSharpBook: true,
      tier: "sharp",
      movement: {
        openPrice: -120,
        prevPrice: -116,
        currentPrice: -114,
        delta: 2,
        move: 6,
        updatedAt: new Date().toISOString(),
        history: [{ ts: new Date(Date.now() - 60_000).toISOString(), priceAmerican: -120 }, { ts: new Date().toISOString(), priceAmerican: -114 }]
      }
    }),
    book({
      bookKey: "fanduel",
      movement: {
        openPrice: -110,
        prevPrice: -109,
        currentPrice: -109,
        delta: 0,
        move: 1,
        updatedAt: new Date().toISOString(),
        history: [{ ts: new Date(Date.now() - 60_000).toISOString(), priceAmerican: -110 }, { ts: new Date().toISOString(), priceAmerican: -109 }]
      }
    }),
    book({
      bookKey: "draftkings",
      movement: {
        openPrice: -111,
        prevPrice: -110,
        currentPrice: -110,
        delta: 0,
        move: 1,
        updatedAt: new Date().toISOString(),
        history: [{ ts: new Date(Date.now() - 60_000).toISOString(), priceAmerican: -111 }, { ts: new Date().toISOString(), priceAmerican: -110 }]
      }
    })
  ]);

  assert.notEqual(signal.quality, "strong");
});
