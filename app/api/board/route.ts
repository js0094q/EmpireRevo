import { NextResponse } from "next/server";
import type { MarketKey } from "@/lib/odds/schemas";
import type { BoardResponse } from "@/lib/odds/schemas";
import { isValidationError, mapPublicError, publicErrorResponse, validationErrorResponse } from "@/lib/server/odds/apiErrors";
import { buildEditorNote, BOARD_DISCLAIMER } from "@/lib/server/odds/editor";
import { cacheGet, cacheKey, cacheSet } from "@/lib/server/odds/cache";
import { leagueToSportKey } from "@/lib/server/odds/client";
import { cacheControlHeader } from "@/lib/server/odds/env";
import { buildLegacyBoardGames, latestBoardUpdatedAt } from "@/lib/server/odds/legacyBoard";
import { getFairBoard, getNormalizedOdds } from "@/lib/server/odds/oddsService";
import { buildFeed, selectBestValue, selectComingUp } from "@/lib/server/odds/derive";
import { parseIntegerParam, parseLeague, parseMarketsCsv, parseModel, parseRegionsCsv } from "@/lib/server/odds/requestValidation";

export const runtime = "nodejs";

const WINDOW_HOURS = 24;
const DEFAULT_MIN_BOOKS = 4;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const league = parseLeague(url.searchParams.get("sport"), "nba");
    const regions = parseRegionsCsv(url.searchParams.get("regions"), "us");
    const markets = parseMarketsCsv(url.searchParams.get("markets") || url.searchParams.get("market"), "h2h,spreads,totals");
    const requestedMarkets = markets.split(",") as MarketKey[];
    const model = parseModel(url.searchParams.get("model"), "weighted");
    const minBooks = parseIntegerParam({
      name: "minBooks",
      value: url.searchParams.get("minBooks"),
      fallback: DEFAULT_MIN_BOOKS,
      min: 2,
      max: 25
    });
    const sportKey = leagueToSportKey(league);

    const normalized = await getNormalizedOdds({
      sportKey,
      regions,
      markets,
      oddsFormat: "american"
    });
    const cacheId = cacheKey([
      "board",
      ...normalized.cacheBaseParts,
      `markets:${requestedMarkets.join(",")}`,
      `model:${model}`,
      `min:${minBooks}`,
      `window:${WINDOW_HOURS}`
    ]);
    const cached = await cacheGet<BoardResponse>(cacheId);
    if (cached) return NextResponse.json(cached, { headers: cacheControlHeader(30, 120) });

    const fairBoards = await Promise.all(
      requestedMarkets.map((market) =>
        getFairBoard({
          normalizedResult: normalized,
          sportKey,
          regions,
          markets,
          market,
          model,
          minBooks,
          windowHours: WINDOW_HOURS
        })
      )
    );

    const updatedAt = latestBoardUpdatedAt(fairBoards, normalized.fetchedAt);
    const games = buildLegacyBoardGames({
      boards: fairBoards,
      league,
      fallbackUpdatedAt: updatedAt
    });

    const comingUp = selectComingUp(games, WINDOW_HOURS);
    const bestValueNow = selectBestValue(games);
    const feed = buildFeed(games);

    const payload: BoardResponse = {
      league,
      updatedAt,
      meta: {
        generatedAt: updatedAt,
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
