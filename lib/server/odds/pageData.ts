import { headers } from "next/headers";
import { getOddsApiKey } from "@/lib/server/odds/env";
import type { FairBoardResponse } from "@/lib/server/odds/types";

const LEAGUE_TO_SPORTKEY: Record<string, string> = {
  nba: "basketball_nba",
  nfl: "americanfootball_nfl",
  nhl: "icehockey_nhl",
  ncaab: "basketball_ncaab",
  mlb: "baseball_mlb"
};

export function hasOddsKey(): boolean {
  return Boolean(getOddsApiKey());
}

export function toSportKey(league: string): string {
  return LEAGUE_TO_SPORTKEY[league] || LEAGUE_TO_SPORTKEY.nba;
}

export async function fetchFairBoardServer(params: {
  league: string;
  market: "h2h" | "spreads" | "totals";
  model: "sharp" | "equal";
  windowHours: number;
}): Promise<FairBoardResponse> {
  const h = await headers();
  const host = h.get("host") || "localhost:3000";
  const proto = host.includes("localhost") ? "http" : "https";
  const sportKey = toSportKey(params.league);

  const endpoint = new URL(`${proto}://${host}/api/fair`);
  endpoint.searchParams.set("sportKey", sportKey);
  endpoint.searchParams.set("market", params.market);
  endpoint.searchParams.set("model", params.model);
  endpoint.searchParams.set("windowHours", String(params.windowHours));

  const res = await fetch(endpoint.toString(), { cache: "no-store" });
  if (!res.ok) {
    let detail = "";
    try {
      const json = await res.json();
      detail = json?.error || "";
    } catch {
      // ignore parse errors
    }
    throw new Error(detail ? `Failed to load fair board (${res.status}): ${detail}` : `Failed to load fair board (${res.status})`);
  }

  return res.json();
}
