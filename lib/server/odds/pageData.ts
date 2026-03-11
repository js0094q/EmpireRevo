import { getOddsApiKey } from "@/lib/server/odds/env";
import { getActiveMarketsForBoard } from "@/lib/server/odds/fairEngine";
import { getFairBoard, getNormalizedOdds } from "@/lib/server/odds/oddsService";
import type { MarketKey } from "@/lib/odds/schemas";
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

export type FairBoardPageData = {
  board: FairBoardResponse;
  activeMarkets: MarketKey[];
  resolvedMarket: MarketKey;
};

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

export async function fetchFairBoardPageData(params: {
  league: string;
  market: "h2h" | "spreads" | "totals";
  model: "sharp" | "equal" | "weighted";
  windowHours: number;
  historyWindowHours?: number;
  includeBooks?: Set<string>;
  minBooks?: number;
}): Promise<FairBoardPageData> {
  const sportKey = toSportKey(params.league);
  const minBooks = params.minBooks ?? 4;
  const normalizedResult = await getNormalizedOdds({
    sportKey,
    regions: "us",
    markets: "h2h,spreads,totals",
    oddsFormat: "american"
  });
  const activeMarkets = getActiveMarketsForBoard({
    normalized: normalizedResult.normalized,
    model: params.model,
    minBooks,
    includeBooks: params.includeBooks
  });
  const resolvedMarket = activeMarkets.includes(params.market) ? params.market : (activeMarkets[0] ?? params.market);
  const board = await getFairBoard({
    normalizedResult,
    sportKey,
    regions: "us",
    markets: "h2h,spreads,totals",
    market: resolvedMarket,
    model: params.model,
    minBooks,
    includeBooks: params.includeBooks,
    windowHours: params.windowHours,
    historyWindowHours: params.historyWindowHours
  });
  board.activeMarkets = activeMarkets;
  return {
    board,
    activeMarkets,
    resolvedMarket
  };
}
