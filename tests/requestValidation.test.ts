import test from "node:test";
import assert from "node:assert/strict";
import { parseLeague, parseSportKey, parseSportKeysCsv } from "../lib/server/odds/requestValidation";

test("request validation accepts newly supported configured sport keys", () => {
  assert.equal(parseSportKey("baseball_ncaa"), "baseball_ncaa");
  assert.equal(parseSportKey("basketball_wnba"), "basketball_wnba");
  assert.equal(parseSportKey("americanfootball_ncaaf"), "americanfootball_ncaaf");
  assert.deepEqual(parseSportKeysCsv("baseball_mlb,baseball_ncaa,basketball_wnba"), [
    "baseball_mlb",
    "baseball_ncaa",
    "basketball_wnba"
  ]);
});

test("request validation accepts new league aliases but remains strict", () => {
  assert.equal(parseLeague("college_baseball"), "college_baseball");
  assert.equal(parseLeague("wnba"), "wnba");
  assert.throws(() => parseLeague("unsupported_league"), /league must be one of/);
  assert.throws(() => parseSportKey("unknown_sport"), /sportKey must be one of the supported league sport keys/);
});
