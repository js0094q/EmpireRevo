import { NextResponse } from "next/server";
import type { BoardResponse, LeagueKey } from "@/lib/odds/schemas";
import { buildEditorNote, BOARD_DISCLAIMER } from "@/lib/server/odds/editor";
import { cacheGet, cacheKey, cacheSet } from "@/lib/server/odds/cache";
import { fetchOddsFromUpstream, leagueToSportKey } from "@/lib/server/odds/client";
import { cacheControlHeader } from "@/lib/server/odds/env";
import { normalizeOddsApiResponse } from "@/lib/server/odds/normalize";
import { buildFeed, deriveGames, selectBestValue, selectComingUp } from "@/lib/server/odds/derive";

export const runtime = "nodejs";

const movementState = {
  openByKey: {} as Record<string, number>,
  prevByKey: {} as Record<string, number>
};

const WINDOW_HOURS = 24;

function toLeague(input: string): LeagueKey {
  const value = input.toLowerCase();
  if (value === "nfl" || value === "nba" || value === "nhl" || value === "ncaab" || value === "mlb") {
    return value;
  }
  return "nba";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const league = toLeague(url.searchParams.get("sport") || "nba");
  const regions = url.searchParams.get("regions") || "us";
  const markets = url.searchParams.get("markets") || "h2h,spreads,totals";
  const sportKey = leagueToSportKey(league);

  const key = cacheKey(["board", league, regions, markets, WINDOW_HOURS]);
  const hit = cacheGet<BoardResponse>(key);
  if (hit) return NextResponse.json(hit, { headers: cacheControlHeader(30, 120) });

  try {
    const raw = await fetchOddsFromUpstream({
      sportKey,
      regions,
      markets,
      oddsFormat: "american"
    });

    const normalized = normalizeOddsApiResponse({ league, raw });
    const { games, newMovementState } = deriveGames({ normalized, movementState });
    Object.assign(movementState.openByKey, newMovementState.openByKey);
    Object.assign(movementState.prevByKey, newMovementState.prevByKey);

    const comingUp = selectComingUp(games, WINDOW_HOURS);
    const bestValueNow = selectBestValue(games);
    const feed = buildFeed(games);

    const payload: BoardResponse = {
      league,
      updatedAt: new Date().toISOString(),
      meta: {
        generatedAt: new Date().toISOString(),
        windowHours: WINDOW_HOURS,
        disclaimer: BOARD_DISCLAIMER
      },
      editorNote: buildEditorNote({
        comingUp,
        bestValueNow,
        feedCount: feed.length
      }),
      comingUp,
      bestValueNow,
      games,
      feed
    };

    cacheSet(key, payload, 20_000);
    return NextResponse.json(payload, { headers: cacheControlHeader(30, 120) });
  } catch (error) {
    const e = error as Error & { code?: string; status?: number; body?: string };

    if (e.code === "MISSING_KEY") {
      return NextResponse.json({ error: "Missing ODDS_API_KEY" }, { status: 500 });
    }

    if (e.code === "UPSTREAM_ERROR") {
      return NextResponse.json(
        {
          error: "Upstream error",
          status: e.status || 502,
          body: e.body || ""
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        error: "Unexpected server error",
        message: e.message
      },
      { status: 500 }
    );
  }
}
