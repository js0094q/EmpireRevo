import { getOddsApiKey } from "@/lib/server/odds/env";
import { getMarketAvailabilityForBoard, LIMITED_MARKET_MIN_BOOKS } from "@/lib/server/odds/fairEngine";
import { getFairBoard, getNormalizedOdds } from "@/lib/server/odds/oddsService";
import { buildBoardDrilldownRows } from "@/lib/server/odds/boardView";
import { fetchPropsBoardData, type PropEventRef, type PropsBoardData } from "@/lib/server/odds/propsService";
import { toSportKey } from "@/lib/server/odds/sportsRegistry";
import type { MarketKey } from "@/lib/odds/schemas";
import type { FairBoardResponse, MarketAvailability, MarketAvailabilityStatus } from "@/lib/server/odds/types";
import type { BoardScope, PropType } from "@/lib/ui/propsDisplay";

export { toSportKey } from "@/lib/server/odds/sportsRegistry";

export function hasOddsKey(): boolean {
  return Boolean(getOddsApiKey());
}

export type FairBoardPageData = {
  board: FairBoardResponse;
  activeMarkets: MarketKey[];
  marketAvailability: MarketAvailability[];
  resolvedMarket: MarketKey;
  resolvedStatus: MarketAvailabilityStatus;
  providerEventCount: number;
  propsData: PropsBoardData | null;
};

function hasRenderableLimitedBoard(entry: MarketAvailability): boolean {
  return entry.status === "limited" && entry.comparableEventCount > 0;
}

export function resolveRequestedMarket(params: {
  requestedMarket: MarketKey;
  marketAvailability: MarketAvailability[];
}): {
  activeMarkets: MarketKey[];
  resolvedMarket: MarketKey;
  resolvedStatus: MarketAvailabilityStatus;
} {
  const activeMarkets = params.marketAvailability.filter((entry) => entry.status === "active").map((entry) => entry.market);
  const renderableLimitedMarkets = params.marketAvailability
    .filter((entry) => hasRenderableLimitedBoard(entry))
    .map((entry) => entry.market);
  const requestedAvailability = params.marketAvailability.find((entry) => entry.market === params.requestedMarket);
  const requestedIsRenderable = requestedAvailability ? requestedAvailability.status === "active" || hasRenderableLimitedBoard(requestedAvailability) : false;

  const resolvedMarket =
    requestedIsRenderable ? params.requestedMarket : activeMarkets[0] ?? renderableLimitedMarkets[0] ?? params.requestedMarket;
  const resolvedStatus = params.marketAvailability.find((entry) => entry.market === resolvedMarket)?.status ?? "unavailable";

  return {
    activeMarkets,
    resolvedMarket,
    resolvedStatus
  };
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

export async function fetchFairBoardPageData(params: {
  league: string;
  market: "h2h" | "spreads" | "totals";
  model: "sharp" | "equal" | "weighted";
  windowHours: number;
  historyWindowHours?: number;
  includeBooks?: Set<string>;
  minBooks?: number;
  scope?: BoardScope;
  propType?: PropType;
}): Promise<FairBoardPageData> {
  const sportKey = toSportKey(params.league);
  const minBooks = params.minBooks ?? 4;
  const normalizedResult = await getNormalizedOdds({
    sportKey,
    regions: "us",
    markets: "h2h,spreads,totals",
    oddsFormat: "american"
  });
  const marketAvailability = getMarketAvailabilityForBoard({
    normalized: normalizedResult.normalized,
    model: params.model,
    minBooks,
    includeBooks: params.includeBooks
  });
  const { activeMarkets, resolvedMarket, resolvedStatus } = resolveRequestedMarket({
    requestedMarket: params.market,
    marketAvailability
  });
  const effectiveMinBooks = resolvedStatus === "limited" ? LIMITED_MARKET_MIN_BOOKS : minBooks;
  const board = await getFairBoard({
    normalizedResult,
    sportKey,
    regions: "us",
    markets: "h2h,spreads,totals",
    market: resolvedMarket,
    model: params.model,
    minBooks: effectiveMinBooks,
    includeBooks: params.includeBooks,
    windowHours: params.windowHours,
    historyWindowHours: params.historyWindowHours,
    marketAvailability
  });
  board.boardRows = buildBoardDrilldownRows(board, { minBooks: effectiveMinBooks });
  board.activeMarkets = activeMarkets;
  board.marketAvailability = marketAvailability;
  const propsData =
    params.scope === "props"
      ? await fetchPropsBoardData({
          league: params.league,
          propType: params.propType ?? "main",
          events: normalizedResult.normalized.map((entry): PropEventRef => ({
            providerEventId: entry.event.providerEventId || "",
            routeEventId: entry.event.id,
            sportKey,
            commenceTime: entry.event.commenceTime,
            homeTeam: entry.event.home.name,
            awayTeam: entry.event.away.name
          })),
          minBooks: effectiveMinBooks
        })
      : null;
  return {
    board,
    activeMarkets,
    marketAvailability,
    resolvedMarket,
    resolvedStatus,
    providerEventCount: normalizedResult.normalized.length,
    propsData
  };
}
