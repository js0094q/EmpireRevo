import { NextResponse } from "next/server";
import { cacheGet, cacheKey, cacheSet } from "@/lib/server/odds/cache";
import { fetchOddsFromUpstream, sportKeyToLeague } from "@/lib/server/odds/client";
import { cacheControlHeader } from "@/lib/server/odds/env";
import { normalizeOddsApiResponse } from "@/lib/server/odds/normalize";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sportKey = url.searchParams.get("sportKey") || "basketball_nba";
  const regions = url.searchParams.get("regions") || "us";
  const markets = url.searchParams.get("markets") || "h2h,spreads,totals";
  const oddsFormat = url.searchParams.get("oddsFormat") || "american";

  const key = cacheKey(["odds", sportKey, regions, markets, oddsFormat]);
  const hit = cacheGet<any>(key);
  if (hit) return NextResponse.json(hit, { headers: cacheControlHeader(15, 60) });

  try {
    const raw = await fetchOddsFromUpstream({ sportKey, regions, markets, oddsFormat });
    const league = sportKeyToLeague(sportKey);
    const normalized = normalizeOddsApiResponse({ league, raw });
    const payload = {
      league,
      fetchedAt: new Date().toISOString(),
      normalized
    };

    cacheSet(key, payload, 10_000);
    return NextResponse.json(payload, { headers: cacheControlHeader(15, 60) });
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
