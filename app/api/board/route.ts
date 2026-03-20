import { NextResponse } from "next/server";
import type { BoardResponse } from "@/lib/odds/schemas";
import { isValidationError, mapPublicError, publicErrorResponse, validationErrorResponse } from "@/lib/server/odds/apiErrors";
import { buildEditorNote, BOARD_DISCLAIMER } from "@/lib/server/odds/editor";
import { cacheGet, cacheKey, cacheSet } from "@/lib/server/odds/cache";
import { leagueToSportKey } from "@/lib/server/odds/client";
import { cacheControlHeader } from "@/lib/server/odds/env";
import { getNormalizedOdds } from "@/lib/server/odds/oddsService";
import { buildFeed, deriveGames, selectBestValue, selectComingUp } from "@/lib/server/odds/derive";
import { parseLeague, parseMarketsCsv, parseRegionsCsv } from "@/lib/server/odds/requestValidation";

export const runtime = "nodejs";

const movementState = {
  openByKey: {} as Record<string, number>,
  prevByKey: {} as Record<string, number>
};

const WINDOW_HOURS = 24;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const league = parseLeague(url.searchParams.get("sport"), "nba");
    const regions = parseRegionsCsv(url.searchParams.get("regions"), "us");
    const markets = parseMarketsCsv(url.searchParams.get("markets"), "h2h,spreads,totals");
    const sportKey = leagueToSportKey(league);

    const normalized = await getNormalizedOdds({
      sportKey,
      regions,
      markets,
      oddsFormat: "american"
    });
    const cacheId = cacheKey(["board", ...normalized.cacheBaseParts, `window:${WINDOW_HOURS}`]);
    const cached = await cacheGet<BoardResponse>(cacheId);
    if (cached) return NextResponse.json(cached, { headers: cacheControlHeader(30, 120) });

    const { games, newMovementState } = deriveGames({ normalized: normalized.normalized, movementState });
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

    await cacheSet(cacheId, payload, 20_000);
    return NextResponse.json(payload, { headers: cacheControlHeader(30, 120) });
  } catch (error) {
    if (isValidationError(error)) {
      return validationErrorResponse(error);
    }

    const mapped = mapPublicError(error);
    return publicErrorResponse(mapped);
  }
}
