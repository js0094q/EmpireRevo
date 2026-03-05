import { NextResponse } from "next/server";
import { cacheGet, cacheKey, cacheSet } from "@/lib/server/odds/cache";
import { fetchOddsFromUpstream, sportKeyToLeague } from "@/lib/server/odds/client";
import { cacheControlHeader } from "@/lib/server/odds/env";
import { normalizeOddsApiResponse } from "@/lib/server/odds/normalize";
import { buildFairBoard } from "@/lib/server/odds/fairEngine";

export const runtime = "nodejs";

function parseMarket(value: string | null): "h2h" | "spreads" | "totals" {
  if (value === "spreads" || value === "totals") return value;
  return "h2h";
}

function parseModel(value: string | null): "sharp" | "equal" {
  return value === "equal" ? "equal" : "sharp";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sportKey = url.searchParams.get("sportKey") || "basketball_nba";
  const market = parseMarket(url.searchParams.get("market"));
  const model = parseModel(url.searchParams.get("model"));
  const regions = url.searchParams.get("regions") || "us";
  const minBooks = Number(url.searchParams.get("minBooks") || 4);
  const windowHours = Number(url.searchParams.get("windowHours") || 24);

  const includeBooksRaw = url.searchParams.get("books") || "";
  const includeBooks = new Set(
    includeBooksRaw
      .split(",")
      .map((book) => book.trim())
      .filter(Boolean)
  );

  const key = cacheKey([
    "fair",
    sportKey,
    market,
    model,
    regions,
    minBooks,
    windowHours,
    Array.from(includeBooks).sort().join(",")
  ]);
  const hit = cacheGet<any>(key);
  if (hit) return NextResponse.json(hit, { headers: cacheControlHeader(30, 120) });

  try {
    const raw = await fetchOddsFromUpstream({
      sportKey,
      regions,
      markets: "h2h,spreads,totals",
      oddsFormat: "american"
    });

    const league = sportKeyToLeague(sportKey);
    const normalized = normalizeOddsApiResponse({ league, raw });
    const payload = buildFairBoard({
      normalized,
      league,
      sportKey,
      market,
      model,
      minBooks: Number.isFinite(minBooks) ? Math.max(2, minBooks) : 4,
      includeBooks,
      timeWindowHours: Number.isFinite(windowHours) ? Math.max(1, windowHours) : 24
    });

    cacheSet(key, payload, 30_000);
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
