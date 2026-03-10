import type { LeagueKey, MarketKey, NormalizedEventOdds } from "@/lib/odds/schemas";
import type { FairBoardResponse } from "@/lib/server/odds/types";
import { cacheGet, cacheKey, cacheSet } from "@/lib/server/odds/cache";
import { fetchOddsFromUpstream, sportKeyToLeague } from "@/lib/server/odds/client";
import { normalizeOddsApiResponse } from "@/lib/server/odds/normalize";
import { buildFairBoard } from "@/lib/server/odds/fairEngine";
import { trackMovement } from "@/lib/server/odds/movement";
import type { WeightModel } from "@/lib/server/odds/weights";

const DEFAULT_SPORT_KEY = "basketball_nba";
const DEFAULT_REGIONS = "us";
const DEFAULT_MARKETS = "h2h,spreads,totals";
const DEFAULT_ODDS_FORMAT = "american";
const RAW_NORMALIZED_TTL_MS = 15_000;
const FAIR_BOARD_TTL_MS = 30_000;
const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_MIN_BOOKS = 3;
const DEFAULT_WINDOW_HOURS = 24;
const DEFAULT_HISTORY_WINDOW_HOURS = 24;
const DEFAULT_RETENTION_MULTIPLIER = 3;
const MAX_RETENTION_HOURS = 7 * 24;
const DEFAULT_MOVEMENT_POINTS = 1200;
const MIN_MOVEMENT_POINTS = 100;
const MAX_MOVEMENT_POINTS = 5000;

const MARKET_WHITELIST: MarketKey[] = ["h2h", "spreads", "totals"];

export type NormalizedOddsQuery = {
  sportKey?: string;
  regions?: string;
  markets?: string;
  oddsFormat?: string;
};

export type NormalizedOddsResult = {
  sportKey: string;
  league: LeagueKey;
  normalized: NormalizedEventOdds[];
  fetchedAt: string;
  query: {
    sportKey: string;
    regions: string;
    markets: string;
    oddsFormat: string;
  };
  cacheBaseParts: string[];
};

export type FairBoardQuery = NormalizedOddsQuery & {
  market: MarketKey;
  model?: WeightModel;
  minBooks?: number;
  includeBooks?: Set<string>;
  windowHours?: number;
  historyWindowHours?: number;
  retentionHours?: number;
  movementMaxPoints?: number;
  includeMovement?: boolean;
  normalizedResult?: NormalizedOddsResult;
};

function clampRange(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function positiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const rounded = Math.floor(value);
  return rounded > 0 ? rounded : fallback;
}

function canonicalCsv(value: string | null | undefined, fallback: string): string {
  const raw = value && value.trim().length ? value : fallback;
  const normalized = raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  if (!normalized.length) return fallback;
  return Array.from(new Set(normalized)).sort().join(",");
}

function canonicalMarkets(value: string | null | undefined): string {
  const raw = value && value.trim().length ? value : DEFAULT_MARKETS;
  const normalized = raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((part): part is MarketKey => MARKET_WHITELIST.includes(part as MarketKey));
  const unique = Array.from(new Set(normalized));
  if (!unique.length) return DEFAULT_MARKETS;
  return unique.sort().join(",");
}

function canonicalOddsFormat(value: string | null | undefined): string {
  const raw = value && value.trim().length ? value : DEFAULT_ODDS_FORMAT;
  return raw.toLowerCase();
}

function canonicalIncludeBooks(includeBooks?: Set<string>): { set: Set<string> | undefined; key: string } {
  if (!includeBooks || includeBooks.size === 0) {
    return { set: undefined, key: "all" };
  }
  const normalized = new Set(Array.from(includeBooks).map((book) => book.trim().toLowerCase()).filter(Boolean));
  if (normalized.size === 0) {
    return { set: undefined, key: "all" };
  }
  const key = Array.from(normalized).sort().join(",");
  return { set: normalized, key };
}

export async function getNormalizedOdds(params: NormalizedOddsQuery): Promise<NormalizedOddsResult> {
  const sportKey = params.sportKey && params.sportKey.trim().length ? params.sportKey : DEFAULT_SPORT_KEY;
  const regions = canonicalCsv(params.regions, DEFAULT_REGIONS);
  const markets = canonicalMarkets(params.markets);
  const oddsFormat = canonicalOddsFormat(params.oddsFormat);

  const cacheBaseParts = ["odds", sportKey, markets, regions, oddsFormat];
  const normalizedKey = cacheKey(["normalized", ...cacheBaseParts]);
  const cached = await cacheGet<NormalizedOddsResult>(normalizedKey);
  if (cached) return cached;

  const raw = await fetchOddsFromUpstream({
    sportKey,
    regions,
    markets,
    oddsFormat
  });

  const league = sportKeyToLeague(sportKey);
  const normalized = normalizeOddsApiResponse({ league, raw });
  const result: NormalizedOddsResult = {
    sportKey,
    league,
    normalized,
    fetchedAt: new Date().toISOString(),
    query: { sportKey, regions, markets, oddsFormat },
    cacheBaseParts
  };

  await cacheSet(normalizedKey, result, RAW_NORMALIZED_TTL_MS);
  return result;
}

export async function getFairBoard(params: FairBoardQuery): Promise<FairBoardResponse> {
  const normalized = params.normalizedResult || (await getNormalizedOdds(params));
  const market = params.market;
  const model = params.model;
  const minBooks = positiveInt(params.minBooks ?? DEFAULT_MIN_BOOKS, DEFAULT_MIN_BOOKS);
  const windowHours = clampRange(positiveInt(params.windowHours ?? DEFAULT_WINDOW_HOURS, DEFAULT_WINDOW_HOURS), 1, 72);
  const historyWindowHours = clampRange(
    positiveInt(params.historyWindowHours ?? DEFAULT_HISTORY_WINDOW_HOURS, DEFAULT_HISTORY_WINDOW_HOURS),
    1,
    72
  );
  const retentionHours = clampRange(
    positiveInt(params.retentionHours ?? historyWindowHours * DEFAULT_RETENTION_MULTIPLIER, historyWindowHours * DEFAULT_RETENTION_MULTIPLIER),
    historyWindowHours,
    MAX_RETENTION_HOURS
  );
  const maxPoints = clampRange(
    positiveInt(params.movementMaxPoints ?? DEFAULT_MOVEMENT_POINTS, DEFAULT_MOVEMENT_POINTS),
    MIN_MOVEMENT_POINTS,
    MAX_MOVEMENT_POINTS
  );
  const movementEnabled = params.includeMovement !== false;
  const { set: includeBooks, key: includeBooksKey } = canonicalIncludeBooks(params.includeBooks);

  const fairKey = cacheKey([
    "fairBoard",
    ...normalized.cacheBaseParts,
    market,
    model || "weighted",
    `min:${minBooks}`,
    `books:${includeBooksKey}`,
    `window:${windowHours}`,
    `history:${historyWindowHours}`,
    `ret:${retentionHours}`,
    `points:${maxPoints}`,
    movementEnabled ? "mv:on" : "mv:off"
  ]);
  const cached = await cacheGet<FairBoardResponse>(fairKey);
  if (cached) return cached;

  const board = await buildFairBoard({
    normalized: normalized.normalized,
    league: normalized.league,
    sportKey: normalized.sportKey,
    market,
    model,
    minBooks,
    includeBooks,
    timeWindowHours: windowHours
  });

  if (movementEnabled) {
    await attachMovement(board, { historyWindowHours, retentionHours, maxPoints });
  }

  await cacheSet(fairKey, board, FAIR_BOARD_TTL_MS);
  return board;
}

async function attachMovement(
  board: FairBoardResponse,
  options: { historyWindowHours: number; retentionHours: number; maxPoints: number }
): Promise<void> {
  const windowMs = options.historyWindowHours * HOUR_MS;
  const retentionMs = options.retentionHours * HOUR_MS;
  await Promise.all(
    board.events.map((event) =>
      Promise.all(
        event.outcomes.map((outcome) =>
          Promise.all(
            outcome.books.map(async (book) => {
              const movement = await trackMovement(
                `${event.id}|${event.market}|${outcome.name}|${book.bookKey}|${book.point ?? "na"}`,
                book.priceAmerican,
                {
                  windowMs,
                  retentionMs,
                  maxPoints: options.maxPoints
                }
              );
              book.movement = movement;
            })
          )
        )
      )
    )
  );
}
