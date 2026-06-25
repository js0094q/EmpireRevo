import test from "node:test";
import assert from "node:assert/strict";
import { resolveMarketRequest } from "../lib/server/odds/marketSupport";

test("college baseball main scope reports unsupported props request", () => {
  const resolution = resolveMarketRequest({
    scope: "props",
    propType: "main",
    league: "college_baseball"
  });

  assert.equal(resolution.sportKey, "baseball_ncaa");
  assert.deepEqual(resolution.markets, []);
  assert.equal(resolution.marketFamily, "unsupported");
  assert.equal(resolution.fetchMode, "unsupported");
  assert.equal(resolution.emptyStateReason, "PROPS_UNSUPPORTED_FOR_LEAGUE");
  assert.equal(resolution.unsupportedReason, "College Baseball props are not currently supported by the odds provider.");
});

test("college baseball player props return a provider-aware unsupported state", () => {
  const resolution = resolveMarketRequest({
    scope: "props",
    propType: "player",
    league: "college_baseball"
  });

  assert.equal(resolution.sportKey, "baseball_ncaa");
  assert.deepEqual(resolution.markets, []);
  assert.equal(resolution.marketFamily, "player_prop");
  assert.equal(resolution.fetchMode, "unsupported");
  assert.equal(resolution.emptyStateReason, "PROPS_UNSUPPORTED_FOR_LEAGUE");
  assert.equal(resolution.unsupportedReason, "College Baseball props are not currently supported by the odds provider.");
});

test("college baseball game props return a provider-aware unsupported state", () => {
  const resolution = resolveMarketRequest({
    scope: "props",
    propType: "game",
    league: "college_baseball"
  });

  assert.equal(resolution.marketFamily, "game_prop");
  assert.equal(resolution.fetchMode, "unsupported");
  assert.equal(resolution.emptyStateReason, "PROPS_UNSUPPORTED_FOR_LEAGUE");
  assert.equal(resolution.unsupportedReason, "College Baseball props are not currently supported by the odds provider.");
});

test("college baseball keeps main markets supported while disabling props", () => {
  const resolution = resolveMarketRequest({
    scope: "board",
    propType: "main",
    league: "college_baseball"
  });

  assert.equal(resolution.sportKey, "baseball_ncaa");
  assert.deepEqual(resolution.markets, ["h2h", "spreads", "totals"]);
  assert.equal(resolution.marketFamily, "main");
  assert.equal(resolution.fetchMode, "league");
  assert.equal(resolution.evPolicy, "allow");
});

test("MLB player props use event-level fetching", () => {
  const resolution = resolveMarketRequest({
    scope: "props",
    propType: "player",
    league: "mlb"
  });

  assert.equal(resolution.sportKey, "baseball_mlb");
  assert.equal(resolution.fetchMode, "event");
  assert.equal(resolution.marketFamily, "player_prop");
  assert.ok(resolution.markets.includes("batter_hits"));
});

test("FIFA World Cup supports main markets and returns a provider-aware unsupported props state", () => {
  const main = resolveMarketRequest({
    scope: "board",
    propType: "main",
    league: "fifa_world_cup"
  });

  assert.equal(main.sportKey, "soccer_fifa_world_cup");
  assert.deepEqual(main.markets, ["h2h", "spreads", "totals"]);
  assert.equal(main.fetchMode, "league");
  assert.equal(main.evPolicy, "allow");

  const props = resolveMarketRequest({
    scope: "props",
    propType: "game",
    league: "fifa_world_cup"
  });

  assert.equal(props.sportKey, "soccer_fifa_world_cup");
  assert.equal(props.marketFamily, "game_prop");
  assert.equal(props.fetchMode, "unsupported");
  assert.equal(props.emptyStateReason, "PROPS_UNSUPPORTED_FOR_LEAGUE");
  assert.equal(props.unsupportedReason, "FIFA World Cup props are not currently supported by the odds provider.");
});
