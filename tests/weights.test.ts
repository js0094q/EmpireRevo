import test from "node:test";
import assert from "node:assert/strict";
import { getBookRef, getWeight, isBookEnabledForModel } from "../lib/server/odds/weights";

test("weight table matches the expanded sportsbook universe", () => {
  assert.equal(getWeight("betcris", "weighted"), 0.85);
  assert.equal(getWeight("betonline_ag", "weighted"), 0.75);
  assert.equal(getWeight("heritage", "weighted"), 0.7);
  assert.equal(getWeight("espn_bet", "weighted"), 0.3);
  assert.equal(getWeight("williamhill_us", "weighted"), 0.34);
  assert.equal(getWeight("superbook_us", "weighted"), 0.25);
  assert.equal(getWeight("betfair_ex_uk", "weighted"), 0.6);
  assert.equal(getWeight("bovada", "weighted"), 0.12);
});

test("sharp model only includes tier-one books", () => {
  assert.equal(getWeight("bookmaker", "sharp"), 0.85);
  assert.equal(getWeight("draftkings", "sharp"), 0);
  assert.equal(isBookEnabledForModel("circa", "sharp"), true);
  assert.equal(isBookEnabledForModel("fanduel", "sharp"), false);
});

test("book refs preserve exchange tier metadata", () => {
  const book = getBookRef("matchbook", "Matchbook");
  assert.equal(book.tier, "exchange");
  assert.equal(book.weight, 0.6);
  assert.equal(book.isSharpWeighted, false);
});
