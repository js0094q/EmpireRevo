import test from "node:test";
import assert from "node:assert/strict";
import type { NormalizedEventOdds } from "@/lib/odds/schemas";
import { eventDetailHref } from "@/components/board/board-helpers";
import { buildFairEventsForNormalizedEvent } from "@/lib/server/odds/fairEngine";
import { matchesEventRouteId, normalizeSlugPart, toEventRouteId } from "@/lib/server/odds/eventRoute";

function buildNormalizedEvent(params: {
  id: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
}): NormalizedEventOdds {
  return {
    event: {
      id: params.id,
      league: "nba",
      commenceTime: params.commenceTime,
      home: { id: params.homeTeam.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name: params.homeTeam },
      away: { id: params.awayTeam.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name: params.awayTeam },
      status: "upcoming"
    },
    fetchedAt: "2026-03-20T12:00:00.000Z",
    books: [
      {
        book: { key: "pinnacle", title: "Pinnacle", tier: "sharp", weight: 1, isSharpWeighted: true },
        markets: [
          {
            market: "h2h",
            lastUpdate: "2026-03-20T12:00:00.000Z",
            outcomes: [
              { name: params.awayTeam, price: -120 },
              { name: params.homeTeam, price: 108 }
            ]
          }
        ]
      },
      {
        book: { key: "draftkings", title: "DraftKings", tier: "mainstream", weight: 0.4, isSharpWeighted: false },
        markets: [
          {
            market: "h2h",
            lastUpdate: "2026-03-20T12:01:00.000Z",
            outcomes: [
              { name: params.awayTeam, price: -115 },
              { name: params.homeTeam, price: 104 }
            ]
          }
        ]
      }
    ]
  };
}

test("normalizeSlugPart normalizes punctuation, case, and spacing", () => {
  assert.equal(normalizeSlugPart("  Boston   Celtics!!! "), "boston-celtics");
  assert.equal(normalizeSlugPart("St. John's  Red Storm"), "st-john-s-red-storm");
  assert.equal(normalizeSlugPart("München & Köln"), "munchen-and-koln");
});

test("toEventRouteId is stable across formatting variants of the same logical game", () => {
  const canonical = toEventRouteId({
    sportKey: "basketball_nba",
    commenceTime: "2026-03-21T00:10:00.000Z",
    homeTeam: "Memphis Grizzlies",
    awayTeam: "Boston Celtics"
  });
  const variant = toEventRouteId({
    league: "nba",
    commenceTime: "2026-03-21 00:10:00+00:00",
    home: { id: "memphis-grizzlies", name: " MEMPHIS   grizzlies " },
    away: { id: "boston-celtics", name: "boston-celtics" },
    id: "legacy-id"
  });

  assert.equal(canonical, "nba_boston-celtics_at_memphis-grizzlies_2026-03-21t00-10-00z");
  assert.equal(variant, canonical);
});

test("matchesEventRouteId supports canonical and legacy ids", () => {
  const event = {
    id: "nba_boston_celtics_at_memphis_grizzlies_2026-03-21T00:10:00.000Z:3.5|-3.5",
    baseEventId: "nba_boston_celtics_at_memphis_grizzlies_2026-03-21T00:10:00.000Z",
    sportKey: "basketball_nba",
    commenceTime: "2026-03-21T00:10:00.000Z",
    homeTeam: "Memphis Grizzlies",
    awayTeam: "Boston Celtics"
  };
  const canonicalRouteId = toEventRouteId(event);

  assert.equal(matchesEventRouteId(event, canonicalRouteId), true);
  assert.equal(matchesEventRouteId(event, event.id), true);
  assert.equal(matchesEventRouteId(event, event.baseEventId), true);
  assert.equal(matchesEventRouteId(event, "nba_lakers_at_warriors_2026-03-21t00-10-00z"), false);
});

test("eventDetailHref route ids resolve against the same event candidates used by detail lookup", () => {
  const bostonMemphis = buildNormalizedEvent({
    id: "nba_boston_celtics_at_memphis_grizzlies_2026-03-21T00:10:00.000Z",
    commenceTime: "2026-03-21T00:10:00.000Z",
    homeTeam: "Memphis Grizzlies",
    awayTeam: "Boston Celtics"
  });
  const lakersWarriors = buildNormalizedEvent({
    id: "nba_los_angeles_lakers_at_golden_state_warriors_2026-03-21T02:10:00.000Z",
    commenceTime: "2026-03-21T02:10:00.000Z",
    homeTeam: "Golden State Warriors",
    awayTeam: "Los Angeles Lakers"
  });

  const allEvents = [bostonMemphis, lakersWarriors].flatMap((normalized) =>
    buildFairEventsForNormalizedEvent({
      normalized,
      sportKey: "basketball_nba",
      market: "h2h",
      model: "weighted",
      minBooks: 2
    })
  );
  const target = allEvents.find((entry) => entry.homeTeam === "Memphis Grizzlies");
  assert.ok(target);

  const href = eventDetailHref({
    event: target!,
    league: "nba",
    market: "h2h",
    model: "weighted"
  });
  const encodedRouteId = href.split("/game/")[1]?.split("?")[0] ?? "";
  const decodedRouteId = decodeURIComponent(encodedRouteId);
  const resolved = allEvents.find((candidate) => matchesEventRouteId(candidate, decodedRouteId));

  assert.ok(resolved);
  assert.equal(resolved?.homeTeam, "Memphis Grizzlies");
  assert.equal(resolved?.awayTeam, "Boston Celtics");
});

test("representative NBA detail lookup resolves Boston vs Memphis by canonical route id", () => {
  const bostonMemphis = buildNormalizedEvent({
    id: "nba_boston_celtics_at_memphis_grizzlies_2026-03-21T00:10:00.000Z",
    commenceTime: "2026-03-21T00:10:00.000Z",
    homeTeam: "Memphis Grizzlies",
    awayTeam: "Boston Celtics"
  });
  const clevelandNewYork = buildNormalizedEvent({
    id: "nba_cleveland_cavaliers_at_new_york_knicks_2026-03-21T01:00:00.000Z",
    commenceTime: "2026-03-21T01:00:00.000Z",
    homeTeam: "New York Knicks",
    awayTeam: "Cleveland Cavaliers"
  });

  const candidates = [bostonMemphis, clevelandNewYork].flatMap((normalized) =>
    buildFairEventsForNormalizedEvent({
      normalized,
      sportKey: "basketball_nba",
      market: "h2h",
      model: "weighted",
      minBooks: 2
    })
  );
  const routeId = toEventRouteId({
    sportKey: "basketball_nba",
    commenceTime: "2026-03-21T00:10:00Z",
    homeTeam: "Memphis Grizzlies",
    awayTeam: "Boston Celtics"
  });
  const match = candidates.find((candidate) => matchesEventRouteId(candidate, routeId));

  assert.ok(match);
  assert.equal(match?.homeTeam, "Memphis Grizzlies");
  assert.equal(match?.awayTeam, "Boston Celtics");
});
