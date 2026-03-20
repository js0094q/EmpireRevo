import { NextResponse } from "next/server";
import { isValidationError, mapPublicError, publicErrorResponse, validationErrorResponse } from "@/lib/server/odds/apiErrors";
import { cacheControlHeader } from "@/lib/server/odds/env";
import { getFairBoard } from "@/lib/server/odds/oddsService";
import {
  parseBookList,
  parseIntegerParam,
  parseMarket,
  parseModel,
  parseRegionsCsv,
  parseSportKey
} from "@/lib/server/odds/requestValidation";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sportKey = parseSportKey(url.searchParams.get("sportKey"), "basketball_nba");
    const market = parseMarket(url.searchParams.get("market"), "h2h");
    const model = parseModel(url.searchParams.get("model"), "weighted");
    const regions = parseRegionsCsv(url.searchParams.get("regions"), "us");
    const minBooks = parseIntegerParam({
      name: "minBooks",
      value: url.searchParams.get("minBooks"),
      fallback: 4,
      min: 2,
      max: 25
    });
    const windowHours = parseIntegerParam({
      name: "windowHours",
      value: url.searchParams.get("windowHours"),
      fallback: 24,
      min: 1,
      max: 72
    });
    const historyWindowHours = parseIntegerParam({
      name: "historyWindowHours",
      value: url.searchParams.get("historyWindowHours"),
      fallback: 24,
      min: 1,
      max: 72
    });
    const retentionHours = Math.max(24, Math.min(7 * 24, historyWindowHours * 3));
    const includeBooksList = parseBookList(url.searchParams.get("books"), 25);
    const includeBooks = includeBooksList.length ? new Set(includeBooksList) : undefined;

    const payload = await getFairBoard({
      sportKey,
      regions,
      markets: "h2h,spreads,totals",
      market,
      model,
      minBooks,
      includeBooks,
      windowHours,
      historyWindowHours,
      retentionHours
    });

    return NextResponse.json(payload, { headers: cacheControlHeader(30, 120) });
  } catch (error) {
    if (isValidationError(error)) {
      return validationErrorResponse(error);
    }

    const mapped = mapPublicError(error);
    return publicErrorResponse(mapped);
  }
}
