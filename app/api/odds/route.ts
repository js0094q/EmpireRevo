import { NextResponse } from "next/server";
import type { MarketKey } from "@/lib/odds/schemas";
import { cacheControlHeader } from "@/lib/server/odds/env";
import { getAggregatedOdds } from "@/lib/server/odds/aggregator";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sportKey = url.searchParams.get("sportKey") || "basketball_nba";
  const regions = url.searchParams.get("regions") || "us";
  const marketParam = (url.searchParams.get("market") ||
    url.searchParams.get("markets") ||
    "h2h") as MarketKey;
  const oddsFormat = url.searchParams.get("oddsFormat") || "american";
  const responseFormat = url.searchParams.get("format");

  const market: MarketKey = ["spreads", "totals"].includes(marketParam)
    ? (marketParam as MarketKey)
    : "h2h";

  try {
    const aggregated = await getAggregatedOdds({
      sportKey,
      market,
      regions,
      oddsFormat
    });

    if (responseFormat === "raw") {
      return NextResponse.json(aggregated.rawEvents, { headers: cacheControlHeader(15, 60) });
    }

    return NextResponse.json(
      {
        games: aggregated.games,
        updated: aggregated.updated,
        sportKey: aggregated.sportKey,
        market: aggregated.market,
        marketLabel: aggregated.marketLabel
      },
      { headers: cacheControlHeader(15, 60) }
    );
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
