import { getOddsApiKey } from "@/lib/server/odds/env";
import { getFairBoard } from "@/lib/server/odds/oddsService";
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
  model: "sharp" | "equal" | "weighted";
  windowHours: number;
  historyWindowHours?: number;
  includeBooks?: Set<string>;
  minBooks?: number;
}): Promise<FairBoardResponse> {
  const sportKey = toSportKey(params.league);
  return getFairBoard({
    sportKey,
    regions: "us",
    markets: "h2h,spreads,totals",
    market: params.market,
    model: params.model,
    minBooks: params.minBooks ?? 4,
    includeBooks: params.includeBooks,
    windowHours: params.windowHours,
    historyWindowHours: params.historyWindowHours
  });
}
