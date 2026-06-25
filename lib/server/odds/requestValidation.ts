import type { LeagueKey, MarketKey } from "@/lib/odds/schemas";
import { LEAGUE_REGISTRY, configuredOrDefaultSportKeys, getLeagueConfig, type LeagueConfig } from "@/lib/server/odds/sportConfig";
import type { WeightModel } from "@/lib/server/odds/weights";
import type { BoardScope, PropType } from "@/lib/ui/propsDisplay";

const MARKET_KEYS = new Set<MarketKey>(["h2h", "spreads", "totals"]);
const WEIGHT_MODELS = new Set<WeightModel>(["sharp", "equal", "weighted"]);
const BOARD_SCOPES = new Set<BoardScope>(["board", "props"]);
const PROP_TYPES = new Set<PropType>(["main", "player", "team", "game", "futures"]);
const LEAGUE_KEYS = new Set<LeagueKey>(LEAGUE_REGISTRY.map((league) => league.key));
const SPORT_KEYS = new Set(LEAGUE_REGISTRY.map((league) => league.sportKey));
const ODDS_FORMATS = new Set(["american", "decimal"]);
const REGION_CODES = new Set(["us", "us2", "uk", "eu", "au"]);
const SPORT_KEY_PATTERN = /^[a-z0-9_]+$/;
const BOOK_KEY_PATTERN = /^[a-z0-9_:-]+$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9:_|.-]+$/;

export class RequestValidationError extends Error {
  readonly status = 400;
  readonly code = "BAD_REQUEST" as const;

  constructor(message: string) {
    super(message);
    this.name = "RequestValidationError";
  }
}

function invalid(message: string): never {
  throw new RequestValidationError(message);
}

function normalize(value: string | null | undefined): string {
  return (value || "").trim();
}

function leagueList(): string {
  return Array.from(LEAGUE_KEYS).sort().join(", ");
}

function sportKeyForLeague(league: LeagueKey): string {
  return getLeagueConfig(league)?.sportKey ?? "basketball_nba";
}

function requireStandardLeagueConfig(config: LeagueConfig): LeagueConfig {
  if (!config.supportsStandardMarkets) {
    invalid("league must support standard board markets");
  }
  return config;
}

function readAllowedSportKeys(): Set<string> {
  const allowed = new Set<string>(SPORT_KEYS);
  for (const entry of configuredOrDefaultSportKeys()) {
    if (entry.length <= 64 && SPORT_KEY_PATTERN.test(entry)) {
      allowed.add(entry);
    }
  }
  return allowed;
}

export function parseLeague(value: string | null, fallback: LeagueKey = "nba"): LeagueKey {
  const normalized = normalize(value).toLowerCase();
  if (!normalized) return fallback;
  if (!LEAGUE_KEYS.has(normalized as LeagueKey)) {
    invalid(`league must be one of ${leagueList()}`);
  }
  return normalized as LeagueKey;
}

export function parseSportKey(value: string | null, fallback = "basketball_nba"): string {
  const normalized = normalize(value).toLowerCase();
  if (!normalized) return fallback;
  if (normalized.length > 64 || !SPORT_KEY_PATTERN.test(normalized)) {
    invalid("sportKey must match [a-z0-9_] and be at most 64 characters");
  }
  const allowedSportKeys = readAllowedSportKeys();
  if (!allowedSportKeys.has(normalized)) {
    invalid("sportKey must be one of the supported league sport keys");
  }
  return normalized;
}

export function parseSportKeysCsv(value: string | null, fallback = "basketball_nba"): string[] {
  const normalized = normalize(value);
  const source = normalized || fallback;
  const entries = source
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  if (!entries.length || entries.length > 8) {
    invalid("sportKeys must include 1 to 8 values");
  }

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const sportKey = parseSportKey(entry);
    if (seen.has(sportKey)) continue;
    seen.add(sportKey);
    deduped.push(sportKey);
  }
  return deduped;
}

export function parseSportKeyOrLeague(params: {
  sportKey: string | null;
  league?: string | null;
  sport?: string | null;
  fallbackSportKey?: string;
}): string {
  const rawSportKey = normalize(params.sportKey);
  if (rawSportKey) return parseSportKey(rawSportKey, params.fallbackSportKey ?? "basketball_nba");

  const rawLeague = normalize(params.league || params.sport);
  if (rawLeague) {
    const config = getLeagueConfig(rawLeague.toLowerCase());
    if (!config) {
      invalid(`league must be one of ${leagueList()}`);
    }
    return parseSportKey(config.sportKey, params.fallbackSportKey ?? "basketball_nba");
  }

  return parseSportKey(null, params.fallbackSportKey ?? "basketball_nba");
}

export function parseBoardSportSelection(params: {
  sportKey: string | null;
  league?: string | null;
  sport?: string | null;
  fallbackLeague?: LeagueKey;
}): { league: LeagueKey; sportKey: string } {
  const rawSportKey = normalize(params.sportKey);
  if (rawSportKey) {
    const sportKey = parseSportKey(rawSportKey);
    const config = getLeagueConfig(sportKey);
    if (!config) {
      invalid("sportKey must map to a configured board league");
    }
    const boardConfig = requireStandardLeagueConfig(config);
    return { league: boardConfig.key, sportKey };
  }

  const rawLeague = normalize(params.league || params.sport);
  if (rawLeague) {
    const config = getLeagueConfig(rawLeague.toLowerCase());
    if (!config) {
      invalid(`league must be one of ${leagueList()}`);
    }
    const boardConfig = requireStandardLeagueConfig(config);
    return { league: boardConfig.key, sportKey: boardConfig.sportKey };
  }

  const league = params.fallbackLeague ?? "nba";
  return { league, sportKey: sportKeyForLeague(league) };
}

export function parseMarket(value: string | null, fallback: MarketKey = "h2h"): MarketKey {
  const normalized = normalize(value).toLowerCase();
  if (!normalized) return fallback;
  if (!MARKET_KEYS.has(normalized as MarketKey)) {
    invalid("market must be one of h2h, spreads, totals");
  }
  return normalized as MarketKey;
}

export function parseBoardScope(value: string | null, fallback: BoardScope = "board"): BoardScope {
  const normalized = normalize(value).toLowerCase();
  if (!normalized) return fallback;
  if (!BOARD_SCOPES.has(normalized as BoardScope)) {
    invalid("scope must be one of board, props");
  }
  return normalized as BoardScope;
}

export function parsePropType(value: string | null, fallback: PropType = "main"): PropType {
  const normalized = normalize(value).toLowerCase();
  if (!normalized) return fallback;
  if (normalized === "player_props") return "player";
  if (normalized === "team_props") return "team";
  if (normalized === "game_props") return "game";
  if (!PROP_TYPES.has(normalized as PropType)) {
    invalid("propType must be one of main, player, team, game, futures");
  }
  return normalized as PropType;
}

export function parseMarketsCsv(value: string | null, fallback = "h2h,spreads,totals"): string {
  const normalized = normalize(value);
  if (!normalized) return fallback;
  const entries = normalized
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  if (!entries.length || entries.length > 3) {
    invalid("markets must include 1 to 3 values");
  }
  for (const entry of entries) {
    if (!MARKET_KEYS.has(entry as MarketKey)) {
      invalid("markets must only include h2h, spreads, totals");
    }
  }
  return Array.from(new Set(entries)).sort().join(",");
}

export function parseModel(value: string | null, fallback: WeightModel = "weighted"): WeightModel {
  const normalized = normalize(value).toLowerCase();
  if (!normalized) return fallback;
  if (!WEIGHT_MODELS.has(normalized as WeightModel)) {
    invalid("model must be one of sharp, equal, weighted");
  }
  return normalized as WeightModel;
}

export function parseOddsFormat(value: string | null, fallback = "american"): string {
  const normalized = normalize(value).toLowerCase();
  if (!normalized) return fallback;
  if (!ODDS_FORMATS.has(normalized)) {
    invalid("oddsFormat must be one of american, decimal");
  }
  return normalized;
}

export function parseResponseFormat(value: string | null): "summary" | "raw" {
  const normalized = normalize(value).toLowerCase();
  if (!normalized || normalized === "summary") return "summary";
  if (normalized === "raw") return "raw";
  invalid("format must be one of summary, raw");
}

export function parseRegionsCsv(value: string | null, fallback = "us"): string {
  const normalized = normalize(value);
  if (!normalized) return fallback;
  const entries = normalized
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  if (!entries.length || entries.length > 4) {
    invalid("regions must include 1 to 4 values");
  }
  for (const entry of entries) {
    if (!REGION_CODES.has(entry)) {
      invalid("regions must only include us, us2, uk, eu, au");
    }
  }
  return Array.from(new Set(entries)).sort().join(",");
}

export function parseIntegerParam(params: {
  name: string;
  value: string | null;
  fallback: number;
  min: number;
  max: number;
}): number {
  const normalized = normalize(params.value);
  if (!normalized) return params.fallback;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    invalid(`${params.name} must be an integer`);
  }
  if (parsed < params.min || parsed > params.max) {
    invalid(`${params.name} must be between ${params.min} and ${params.max}`);
  }
  return parsed;
}

export function parseRollingPoints(value: string | null): number | undefined {
  const normalized = normalize(value);
  if (!normalized) return undefined;
  return parseIntegerParam({
    name: "rolling",
    value: normalized,
    fallback: 0,
    min: 1,
    max: 5000
  });
}

export function parseBookList(value: string | null, maxItems = 20): string[] {
  const normalized = normalize(value);
  if (!normalized) return [];
  const entries = normalized
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  if (!entries.length) return [];
  if (entries.length > maxItems) {
    invalid(`books must include at most ${maxItems} values`);
  }
  for (const entry of entries) {
    if (entry.length > 40 || !BOOK_KEY_PATTERN.test(entry)) {
      invalid("books entries must match [a-z0-9_:-] and be at most 40 characters");
    }
  }
  return Array.from(new Set(entries));
}

export function parseOpaqueIdentifier(
  value: string | null,
  name: string,
  options: { required?: boolean; maxLength?: number } = {}
): string {
  const normalized = normalize(value);
  if (!normalized) {
    if (options.required) invalid(`${name} is required`);
    return "";
  }
  const maxLength = options.maxLength ?? 140;
  if (normalized.length > maxLength) {
    invalid(`${name} must be at most ${maxLength} characters`);
  }
  if (!IDENTIFIER_PATTERN.test(normalized)) {
    invalid(`${name} contains unsupported characters`);
  }
  return normalized;
}
