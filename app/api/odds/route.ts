import { NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/odds/cache";
import { normalizeOddsApiResponse } from "@/lib/odds/normalize";
import type { LeagueKey } from "@/lib/odds/schemas";

export const runtime = "nodejs";

const DEFAULT_BASE = "https://api.the-odds-api.com";
const DEFAULT_ODDS_FORMAT = "american";

function cacheHeaders(): Record<string, string> {
  const sMaxAge = process.env.EDGE_CACHE_S_MAXAGE || "15";
  const swr = process.env.EDGE_CACHE_SWR || "60";
  return {
    "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`
  };
}

function toLeagueKey(sportKey: string): LeagueKey {
  if (sportKey.includes("nfl")) return "nfl";
  if (sportKey.includes("nba")) return "nba";
  if (sportKey.includes("nhl")) return "nhl";
  if (sportKey.includes("ncaab")) return "ncaab";
  if (sportKey.includes("mlb")) return "mlb";
  return "nba";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sportKey = url.searchParams.get("sportKey") || "americanfootball_nfl";
  const regions = url.searchParams.get("regions") || "us";
  const markets = url.searchParams.get("markets") || "h2h,spreads,totals";
  const oddsFormat = url.searchParams.get("oddsFormat") || DEFAULT_ODDS_FORMAT;

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing ODDS_API_KEY" }, { status: 500 });
  }

  const base = process.env.ODDS_API_BASE || DEFAULT_BASE;
  const cacheKey = `odds|${sportKey}|${regions}|${markets}|${oddsFormat}`;
  const hit = cacheGet<any>(cacheKey);
  if (hit) return NextResponse.json(hit, { headers: cacheHeaders() });

  const upstream = new URL(`${base}/v4/sports/${sportKey}/odds`);
  upstream.searchParams.set("regions", regions);
  upstream.searchParams.set("markets", markets);
  upstream.searchParams.set("oddsFormat", oddsFormat);
  upstream.searchParams.set("apiKey", apiKey);

  const res = await fetch(upstream.toString(), { headers: { Accept: "application/json" } });
  const text = await res.text();
  if (!res.ok) {
    return NextResponse.json(
      { error: "Upstream error", status: res.status, body: text.slice(0, 500) },
      { status: 502 }
    );
  }

  const raw = JSON.parse(text);
  const league = toLeagueKey(sportKey);
  const normalized = normalizeOddsApiResponse({ league, raw });

  const payload = { league, fetchedAt: new Date().toISOString(), normalized };
  cacheSet(cacheKey, payload, 10_000);

  return NextResponse.json(payload, { headers: cacheHeaders() });
}
