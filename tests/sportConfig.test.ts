import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_LEAGUE_KEY,
  DEFAULT_SPORT_KEY,
  LEAGUE_REGISTRY,
  defaultEnabledLeagues,
  getLeagueConfig
} from "../lib/server/odds/sportConfig";
import { toSportKey } from "../lib/server/odds/sportsRegistry";

test("league registry includes college baseball as a first-class summer option", () => {
  const collegeBaseball = getLeagueConfig("college_baseball");

  assert.ok(collegeBaseball);
  assert.equal(collegeBaseball.sportKey, "baseball_ncaa");
  assert.equal(collegeBaseball.label, "College Baseball");
  assert.equal(collegeBaseball.category, "baseball");
  assert.equal(collegeBaseball.supportsStandardMarkets, true);
  assert.ok(defaultEnabledLeagues().some((league) => league.key === "college_baseball"));
});

test("default league registry no longer centers hockey", () => {
  assert.equal(DEFAULT_LEAGUE_KEY, "mlb");
  assert.equal(DEFAULT_SPORT_KEY, "baseball_mlb");
  assert.equal(defaultEnabledLeagues()[0]?.key, "mlb");
  assert.notEqual(defaultEnabledLeagues()[0]?.key, "nhl");
});

test("registry includes active summer and fall sport keys without enabling incompatible golf outrights", () => {
  const sportKeys = new Set(LEAGUE_REGISTRY.map((league) => league.sportKey));

  assert.ok(sportKeys.has("baseball_mlb"));
  assert.ok(sportKeys.has("baseball_ncaa"));
  assert.ok(sportKeys.has("basketball_wnba"));
  assert.ok(sportKeys.has("mma_mixed_martial_arts"));
  assert.ok(sportKeys.has("americanfootball_ncaaf"));
  assert.ok(sportKeys.has("soccer_usa_mls"));
  assert.ok(sportKeys.has("soccer_fifa_world_cup"));
  assert.ok(sportKeys.has("tennis_atp_wimbledon"));

  const golf = getLeagueConfig("golf_us_open");
  assert.equal(golf?.supportsStandardMarkets, false);
  assert.equal(defaultEnabledLeagues().some((league) => league.key === "golf_us_open"), false);
});

test("toSportKey resolves new league aliases", () => {
  assert.equal(toSportKey("college_baseball"), "baseball_ncaa");
  assert.equal(toSportKey("wnba"), "basketball_wnba");
  assert.equal(toSportKey("ncaaf"), "americanfootball_ncaaf");
  assert.equal(toSportKey("fifa_world_cup"), "soccer_fifa_world_cup");
  assert.equal(toSportKey("soccer_fifa_world_cup"), "soccer_fifa_world_cup");
});

test("league registry includes FIFA World Cup as a soccer main-market option", () => {
  const worldCup = getLeagueConfig("fifa_world_cup");

  assert.ok(worldCup);
  assert.equal(worldCup.sportKey, "soccer_fifa_world_cup");
  assert.equal(worldCup.label, "FIFA World Cup");
  assert.equal(worldCup.category, "soccer");
  assert.equal(worldCup.group, "Soccer");
  assert.equal(worldCup.supportsStandardMarkets, true);
  assert.ok(defaultEnabledLeagues().some((league) => league.key === "fifa_world_cup"));
});
