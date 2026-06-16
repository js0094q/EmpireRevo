import { getLeagueConfig } from "@/lib/server/odds/sportConfig";
import type { BoardScope, MarketFamily, PropType, PropsEmptyReason } from "@/lib/ui/propsDisplay";

export type PropFetchMode = "league" | "event" | "unsupported";
export type EvPolicy = "allow" | "suppress" | "line_shopping_only";

export type LeagueMarketSupport = {
  sportKey: string;
  label: string;
  supportsMainLines: boolean;
  supportsPlayerProps: boolean;
  supportsTeamProps: boolean;
  supportsGameProps: boolean;
  supportsFutures: boolean;
  mainMarkets: string[];
  playerPropMarkets: string[];
  teamPropMarkets: string[];
  gamePropMarkets: string[];
  futuresMarkets: string[];
  propFetchMode: PropFetchMode;
  notes?: string;
};

export type MarketRequestResolution = {
  sportKey: string;
  leagueLabel: string;
  markets: string[];
  marketFamily: MarketFamily;
  fetchMode: PropFetchMode;
  evPolicy: EvPolicy;
  emptyStateReason?: PropsEmptyReason;
};

const STANDARD_MAIN_MARKETS = ["h2h", "spreads", "totals"];
const MLB_PLAYER_PROP_MARKETS = [
  "batter_hits",
  "batter_total_bases",
  "batter_rbis",
  "pitcher_strikeouts",
  "pitcher_outs"
];

const MARKET_SUPPORT_OVERRIDES: Record<string, Partial<LeagueMarketSupport>> = {
  baseball_ncaa: {
    supportsMainLines: true,
    supportsPlayerProps: false,
    supportsTeamProps: false,
    supportsGameProps: false,
    supportsFutures: false,
    mainMarkets: STANDARD_MAIN_MARKETS,
    propFetchMode: "unsupported",
    notes: "Provider currently supports NCAA baseball main lines but not additional player prop markets."
  },
  baseball_mlb: {
    supportsMainLines: true,
    supportsPlayerProps: true,
    supportsTeamProps: false,
    supportsGameProps: false,
    supportsFutures: false,
    mainMarkets: STANDARD_MAIN_MARKETS,
    playerPropMarkets: MLB_PLAYER_PROP_MARKETS,
    propFetchMode: "event",
    notes: "MLB player props are fetched event-by-event to keep board payloads bounded."
  }
};

export function getLeagueMarketSupport(leagueOrSportKey: string): LeagueMarketSupport {
  const config = getLeagueConfig(leagueOrSportKey);
  const sportKey = config?.sportKey ?? leagueOrSportKey;
  const override = MARKET_SUPPORT_OVERRIDES[sportKey] ?? {};
  return {
    sportKey,
    label: config?.label ?? sportKey,
    supportsMainLines: config?.supportsStandardMarkets ?? true,
    supportsPlayerProps: false,
    supportsTeamProps: false,
    supportsGameProps: false,
    supportsFutures: false,
    mainMarkets: STANDARD_MAIN_MARKETS,
    playerPropMarkets: [],
    teamPropMarkets: [],
    gamePropMarkets: [],
    futuresMarkets: [],
    propFetchMode: "unsupported",
    notes: config?.notes,
    ...override
  };
}

function unsupportedResolution(support: LeagueMarketSupport, marketFamily: MarketFamily, propType: PropType): MarketRequestResolution {
  return {
    sportKey: support.sportKey,
    leagueLabel: support.label,
    markets: [],
    marketFamily,
    fetchMode: "unsupported",
    evPolicy: "line_shopping_only",
    emptyStateReason: propType === "main" ? "NO_MAIN_MARKETS" : "PROPS_UNSUPPORTED_FOR_LEAGUE"
  };
}

export function resolveMarketRequest(params: {
  scope: BoardScope;
  propType: PropType;
  league: string;
  eventId?: string | null;
}): MarketRequestResolution {
  const support = getLeagueMarketSupport(params.league);
  if (params.scope === "board") {
    return {
      sportKey: support.sportKey,
      leagueLabel: support.label,
      markets: support.mainMarkets,
      marketFamily: "main",
      fetchMode: "league",
      evPolicy: "allow"
    };
  }

  if (params.propType === "main") {
    if (!support.supportsMainLines || !support.mainMarkets.length) {
      return unsupportedResolution(support, "main", params.propType);
    }
    return {
      sportKey: support.sportKey,
      leagueLabel: support.label,
      markets: support.mainMarkets,
      marketFamily: "main",
      fetchMode: "league",
      evPolicy: "allow"
    };
  }

  if (params.propType === "player") {
    if (!support.supportsPlayerProps || !support.playerPropMarkets.length) {
      return unsupportedResolution(support, "player_prop", params.propType);
    }
    return {
      sportKey: support.sportKey,
      leagueLabel: support.label,
      markets: support.playerPropMarkets,
      marketFamily: "player_prop",
      fetchMode: support.propFetchMode,
      evPolicy: "line_shopping_only"
    };
  }

  if (params.propType === "team") {
    if (!support.supportsTeamProps || !support.teamPropMarkets.length) {
      return unsupportedResolution(support, "team_prop", params.propType);
    }
    return {
      sportKey: support.sportKey,
      leagueLabel: support.label,
      markets: support.teamPropMarkets,
      marketFamily: "team_prop",
      fetchMode: support.propFetchMode,
      evPolicy: "line_shopping_only"
    };
  }

  if (params.propType === "game") {
    if (!support.supportsGameProps || !support.gamePropMarkets.length) {
      return unsupportedResolution(support, "game_prop", params.propType);
    }
    return {
      sportKey: support.sportKey,
      leagueLabel: support.label,
      markets: support.gamePropMarkets,
      marketFamily: "game_prop",
      fetchMode: support.propFetchMode,
      evPolicy: "line_shopping_only"
    };
  }

  if (!support.supportsFutures || !support.futuresMarkets.length) {
    return unsupportedResolution(support, "future", params.propType);
  }
  return {
    sportKey: support.sportKey,
    leagueLabel: support.label,
    markets: support.futuresMarkets,
    marketFamily: "future",
    fetchMode: "league",
    evPolicy: "suppress"
  };
}

export function cappedPropMarkets(markets: string[], maxMarkets = 5): string[] {
  return Array.from(new Set(markets)).slice(0, Math.max(1, maxMarkets));
}
