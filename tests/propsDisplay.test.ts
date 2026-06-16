import test from "node:test";
import assert from "node:assert/strict";
import { getPropsDisplayState, normalizePropType, PROP_MARKET_TYPE_OPTIONS } from "../lib/ui/propsDisplay";

test("props display state suppresses EV unless fair probability is defensible", () => {
  const state = getPropsDisplayState();

  assert.equal(state.mode, "line_shopping_only");
  assert.equal(state.evVisible, false);
  assert.match(state.message, /line shopping only/i);
  assert.ok(state.metrics.includes("Best book"));
  assert.ok(state.metrics.includes("Book count"));
});

test("props market type options expose player, team, game, and supported futures filters", () => {
  const values = new Set(PROP_MARKET_TYPE_OPTIONS.map((option) => option.value));

  assert.ok(values.has("main"));
  assert.ok(values.has("player"));
  assert.ok(values.has("team"));
  assert.ok(values.has("game"));
  assert.ok(values.has("futures"));
});

test("props market type aliases normalize old query values", () => {
  assert.equal(normalizePropType("player_props"), "player");
  assert.equal(normalizePropType("team_props"), "team");
  assert.equal(normalizePropType("game_props"), "game");
  assert.equal(normalizePropType("main"), "main");
});
