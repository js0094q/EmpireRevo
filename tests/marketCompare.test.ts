import test from "node:test";
import assert from "node:assert/strict";
import { compareOffersByMarket } from "../lib/server/odds/marketCompare";

test("moneyline compares by payout price", () => {
  const better = compareOffersByMarket(
    "h2h",
    "Team A",
    { priceAmerican: -110 },
    { priceAmerican: +102 }
  );
  assert.ok(better > 0);
});

test("spread comparison prioritizes point then price", () => {
  const betterPoint = compareOffersByMarket(
    "spreads",
    "Team A",
    { point: -4.5, priceAmerican: +100 },
    { point: -3.5, priceAmerican: -115 }
  );
  assert.ok(betterPoint > 0, "getting +1 point should be treated as the better line");

  const tiePointBetterPrice = compareOffersByMarket(
    "spreads",
    "Team A",
    { point: -3.5, priceAmerican: -110 },
    { point: -3.5, priceAmerican: -105 }
  );
  assert.ok(tiePointBetterPrice > 0);
});

test("totals comparison uses directional point value", () => {
  const betterOver = compareOffersByMarket(
    "totals",
    "Over",
    { point: 221.5, priceAmerican: -110 },
    { point: 220.5, priceAmerican: -115 }
  );
  assert.ok(betterOver > 0, "lower total is better for over bettors");

  const betterUnder = compareOffersByMarket(
    "totals",
    "Under",
    { point: 221.5, priceAmerican: -110 },
    { point: 220.5, priceAmerican: -115 }
  );
  assert.ok(betterUnder < 0, "higher total is better for under bettors");
});
