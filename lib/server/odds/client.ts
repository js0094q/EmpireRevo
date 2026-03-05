import type { LeagueKey } from "@/lib/odds/schemas";
import { getOddsApiKey } from "@/lib/server/odds/env";

const DEFAULT_BASE = "https://api.the-odds-api.com";

export function leagueToSportKey(league: LeagueKey): string {
  switch (league) {
    case "nfl":
      return "americanfootball_nfl";
    case "nba":
      return "basketball_nba";
    case "nhl":
      return "icehockey_nhl";
    case "ncaab":
      return "basketball_ncaab";
    case "mlb":
      return "baseball_mlb";
    default:
      return "basketball_nba";
  }
}

export function sportKeyToLeague(sportKey: string): LeagueKey {
  if (sportKey.includes("nfl")) return "nfl";
  if (sportKey.includes("nba")) return "nba";
  if (sportKey.includes("nhl")) return "nhl";
  if (sportKey.includes("ncaab")) return "ncaab";
  if (sportKey.includes("mlb")) return "mlb";
  return "nba";
}

export async function fetchOddsFromUpstream(params: {
  sportKey: string;
  regions: string;
  markets: string;
  oddsFormat?: string;
}): Promise<any[]> {
  const apiKey = getOddsApiKey();
  if (!apiKey) {
    const err = new Error("Missing ODDS_API_KEY");
    (err as Error & { code?: string }).code = "MISSING_KEY";
    throw err;
  }

  const base = process.env.ODDS_API_BASE || DEFAULT_BASE;
  const upstream = new URL(`${base}/v4/sports/${params.sportKey}/odds`);
  upstream.searchParams.set("regions", params.regions);
  upstream.searchParams.set("markets", params.markets);
  upstream.searchParams.set("oddsFormat", params.oddsFormat || "american");
  upstream.searchParams.set("apiKey", apiKey);

  const response = await fetch(upstream.toString(), {
    headers: { Accept: "application/json" }
  });

  const text = await response.text();
  if (!response.ok) {
    const err = new Error(`Upstream error ${response.status}`);
    (err as Error & { status?: number; body?: string; code?: string }).status = response.status;
    (err as Error & { status?: number; body?: string; code?: string }).body = text.slice(0, 500);
    (err as Error & { status?: number; body?: string; code?: string }).code = "UPSTREAM_ERROR";
    throw err;
  }

  return JSON.parse(text);
}
