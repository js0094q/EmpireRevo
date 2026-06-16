import type { MarketKey } from "@/lib/odds/schemas";
import { cacheGet, cacheKey, cacheSet } from "@/lib/server/odds/cache";
import { fetchEventOddsFromUpstream } from "@/lib/server/odds/client";
import { calculateEvPercent } from "@/lib/server/odds/ev";
import { americanToDecimal, americanToRawImpliedProbability, probabilityToAmerican, removeVigWithinGroup } from "@/lib/server/odds/fairMath";
import { cappedPropMarkets, resolveMarketRequest } from "@/lib/server/odds/marketSupport";
import type { MarketFamily, PropType, PropsEmptyReason } from "@/lib/ui/propsDisplay";

const PROP_TTL_MS = 20_000;
const EMPTY_PROP_TTL_MS = 10_000;
const DEFAULT_MAX_EVENTS = 10;
const DEFAULT_MIN_PROP_BOOKS = 3;

export type PropEventRef = {
  providerEventId: string;
  routeEventId: string;
  sportKey: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
};

export type NormalizedPropOutcome = {
  eventId: string;
  routeEventId: string;
  sportKey: string;
  commenceTime: string;
  eventLabel: string;
  marketKey: string;
  marketLabel: string;
  marketFamily: MarketFamily;
  participant?: string;
  team?: string;
  outcomeName: string;
  side?: "over" | "under" | "yes" | "no" | "home" | "away";
  line?: number;
  price: number;
  bookKey: string;
  bookTitle: string;
  lastUpdate: string;
};

export type PropOutcomeGroup = {
  key: string;
  eventId: string;
  routeEventId: string;
  sportKey: string;
  commenceTime: string;
  eventLabel: string;
  marketKey: string;
  marketLabel: string;
  marketFamily: MarketFamily;
  participant?: string;
  team?: string;
  line?: number;
  outcomes: NormalizedPropOutcome[];
};

export type PropBoardRow = {
  id: string;
  href: string;
  event: string;
  eventMeta: string;
  startTime: string;
  market: string;
  marketMeta: string;
  selection: string;
  bestBook: string;
  bestBookKey: string;
  bestPrice: number;
  line?: number;
  bookCount: number;
  updatedAt: string;
  status: "EV available" | "Line shopping only" | "Sparse coverage" | "Unsupported by provider" | "No markets";
  evPct: number | null;
  fairPriceAmerican: number | null;
  confidence: "EV available" | "Line shop";
};

export type PropsBoardData = {
  rows: PropBoardRow[];
  emptyReason?: PropsEmptyReason;
  marketFamily: MarketFamily;
  propType: PropType;
  fetchMode: "league" | "event" | "unsupported";
  requestedMarkets: string[];
  failures: number;
};

type RawOutcome = {
  name: string;
  price: number;
  point?: number;
  description?: string;
  team?: string;
};

type RawMarket = {
  key: string;
  last_update?: string;
  outcomes: RawOutcome[];
};

type RawBookmaker = {
  key: string;
  title: string;
  last_update?: string;
  markets: RawMarket[];
};

type RawEventOdds = {
  id?: string;
  commence_time?: string;
  home_team?: string;
  away_team?: string;
  bookmakers: RawBookmaker[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (typeof value !== "number") return undefined;
  return Number.isFinite(value) ? value : undefined;
}

function parseRawOutcomes(value: unknown): RawOutcome[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const record = asRecord(entry);
    if (!record) return [];
    const name = readString(record, "name");
    const price = readNumber(record, "price");
    if (!name || price === undefined) return [];
    return [
      {
        name,
        price,
        point: readNumber(record, "point"),
        description: readString(record, "description"),
        team: readString(record, "team")
      }
    ];
  });
}

function parseRawMarkets(value: unknown): RawMarket[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const record = asRecord(entry);
    if (!record) return [];
    const key = readString(record, "key");
    if (!key) return [];
    return [
      {
        key,
        last_update: readString(record, "last_update"),
        outcomes: parseRawOutcomes(record.outcomes)
      }
    ];
  });
}

function parseRawBookmakers(value: unknown): RawBookmaker[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const record = asRecord(entry);
    if (!record) return [];
    const key = readString(record, "key");
    if (!key) return [];
    return [
      {
        key,
        title: readString(record, "title") ?? key,
        last_update: readString(record, "last_update"),
        markets: parseRawMarkets(record.markets)
      }
    ];
  });
}

function parseRawEventOdds(payload: unknown): RawEventOdds | null {
  const source = Array.isArray(payload) ? payload[0] : payload;
  const record = asRecord(source);
  if (!record) return null;
  return {
    id: readString(record, "id"),
    commence_time: readString(record, "commence_time"),
    home_team: readString(record, "home_team"),
    away_team: readString(record, "away_team"),
    bookmakers: parseRawBookmakers(record.bookmakers)
  };
}

function marketLabel(marketKey: string): string {
  const known: Record<string, string> = {
    batter_hits: "Batter Hits",
    batter_total_bases: "Batter Total Bases",
    batter_rbis: "Batter RBIs",
    pitcher_strikeouts: "Pitcher Strikeouts",
    pitcher_outs: "Pitcher Outs"
  };
  return known[marketKey] ?? marketKey.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeSide(name: string): NormalizedPropOutcome["side"] {
  const normalized = name.trim().toLowerCase();
  if (normalized === "over") return "over";
  if (normalized === "under") return "under";
  if (normalized === "yes") return "yes";
  if (normalized === "no") return "no";
  if (normalized === "home") return "home";
  if (normalized === "away") return "away";
  return undefined;
}

function hashPart(values: string[]): string {
  return Array.from(new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean)))
    .sort()
    .join("_");
}

export function propsCacheKey(params: {
  sportKey: string;
  eventId: string;
  propType: PropType;
  markets: string[];
  regions: string;
  books?: string[];
  oddsFormat: string;
}): string {
  return cacheKey([
    "props",
    params.sportKey,
    params.eventId,
    params.propType,
    hashPart(params.markets),
    params.regions,
    hashPart(params.books ?? ["all"]),
    params.oddsFormat
  ]);
}

export function normalizePropOddsPayload(params: {
  payload: unknown;
  event: PropEventRef;
  markets: string[];
  marketFamily: MarketFamily;
}): NormalizedPropOutcome[] {
  const raw = parseRawEventOdds(params.payload);
  if (!raw) return [];
  const allowedMarkets = new Set(params.markets);
  const eventLabel = `${raw.away_team || params.event.awayTeam} at ${raw.home_team || params.event.homeTeam}`;
  const commenceTime = raw.commence_time || params.event.commenceTime;

  return raw.bookmakers.flatMap((book) =>
    book.markets
      .filter((market) => allowedMarkets.has(market.key))
      .flatMap((market) =>
        market.outcomes.map((outcome) => ({
          eventId: params.event.providerEventId,
          routeEventId: params.event.routeEventId,
          sportKey: params.event.sportKey,
          commenceTime,
          eventLabel,
          marketKey: market.key,
          marketLabel: marketLabel(market.key),
          marketFamily: params.marketFamily,
          participant: outcome.description,
          team: outcome.team,
          outcomeName: outcome.name,
          side: normalizeSide(outcome.name),
          line: outcome.point,
          price: outcome.price,
          bookKey: book.key,
          bookTitle: book.title,
          lastUpdate: market.last_update || book.last_update || new Date().toISOString()
        }))
      )
  );
}

function groupKey(outcome: NormalizedPropOutcome): string {
  return [
    outcome.eventId,
    outcome.marketKey,
    outcome.participant || "",
    outcome.team || "",
    Number.isFinite(outcome.line) ? `${outcome.line}` : "no_line"
  ].join("|");
}

export function groupPropOutcomes(outcomes: NormalizedPropOutcome[]): PropOutcomeGroup[] {
  const groups = new Map<string, PropOutcomeGroup>();
  for (const outcome of outcomes) {
    const key = groupKey(outcome);
    const existing = groups.get(key);
    if (existing) {
      existing.outcomes.push(outcome);
      continue;
    }
    groups.set(key, {
      key,
      eventId: outcome.eventId,
      routeEventId: outcome.routeEventId,
      sportKey: outcome.sportKey,
      commenceTime: outcome.commenceTime,
      eventLabel: outcome.eventLabel,
      marketKey: outcome.marketKey,
      marketLabel: outcome.marketLabel,
      marketFamily: outcome.marketFamily,
      participant: outcome.participant,
      team: outcome.team,
      line: outcome.line,
      outcomes: [outcome]
    });
  }
  return Array.from(groups.values());
}

function comparablePair(side: NormalizedPropOutcome["side"]): "over_under" | "yes_no" | null {
  if (side === "over" || side === "under") return "over_under";
  if (side === "yes" || side === "no") return "yes_no";
  return null;
}

function fairProbabilitiesForGroup(group: PropOutcomeGroup, minBooks: number): Map<string, number> {
  if (group.marketFamily === "future" || group.marketKey.includes("alternate")) return new Map();
  const byBook = new Map<string, NormalizedPropOutcome[]>();
  for (const outcome of group.outcomes) {
    const entries = byBook.get(outcome.bookKey) ?? [];
    entries.push(outcome);
    byBook.set(outcome.bookKey, entries);
  }

  const sideEntries = new Map<string, number[]>();
  let pairedBookCount = 0;
  for (const outcomes of byBook.values()) {
    const sides = outcomes.filter((outcome) => outcome.side && comparablePair(outcome.side));
    const pairType = comparablePair(sides[0]?.side);
    if (!pairType) continue;
    const firstSide = pairType === "over_under" ? "over" : "yes";
    const secondSide = pairType === "over_under" ? "under" : "no";
    const first = sides.find((outcome) => outcome.side === firstSide);
    const second = sides.find((outcome) => outcome.side === secondSide);
    if (!first || !second) continue;
    const firstRaw = americanToRawImpliedProbability(first.price);
    const secondRaw = americanToRawImpliedProbability(second.price);
    const [firstNoVig, secondNoVig] = removeVigWithinGroup([firstRaw, secondRaw]);
    if (firstNoVig === null || secondNoVig === null) continue;
    pairedBookCount += 1;
    sideEntries.set(firstSide, [...(sideEntries.get(firstSide) ?? []), firstNoVig]);
    sideEntries.set(secondSide, [...(sideEntries.get(secondSide) ?? []), secondNoVig]);
  }

  if (pairedBookCount < minBooks) return new Map();
  const fair = new Map<string, number>();
  for (const [side, probabilities] of sideEntries) {
    if (!probabilities.length) continue;
    fair.set(side, probabilities.reduce((sum, value) => sum + value, 0) / probabilities.length);
  }
  return fair;
}

function bestOutcome(outcomes: NormalizedPropOutcome[]): NormalizedPropOutcome | null {
  return outcomes
    .slice()
    .sort((a, b) => americanToDecimal(b.price) - americanToDecimal(a.price) || Date.parse(b.lastUpdate) - Date.parse(a.lastUpdate))[0] ?? null;
}

export function buildPropBoardRows(params: {
  outcomes: NormalizedPropOutcome[];
  league: string;
  propType: PropType;
  minBooks?: number;
}): PropBoardRow[] {
  const minBooks = Math.max(1, params.minBooks ?? DEFAULT_MIN_PROP_BOOKS);
  return groupPropOutcomes(params.outcomes)
    .flatMap((group) => {
      const fairBySide = fairProbabilitiesForGroup(group, minBooks);
      const sideGroups = new Map<string, NormalizedPropOutcome[]>();
      for (const outcome of group.outcomes) {
        const sideKey = outcome.side ?? outcome.outcomeName.toLowerCase();
        sideGroups.set(sideKey, [...(sideGroups.get(sideKey) ?? []), outcome]);
      }

      return Array.from(sideGroups.entries()).flatMap(([sideKey, outcomes]) => {
        const best = bestOutcome(outcomes);
        if (!best) return [];
        const uniqueBooks = new Set(outcomes.map((outcome) => outcome.bookKey));
        const fairProb = fairBySide.get(sideKey) ?? null;
        const evPct = fairProb === null ? null : calculateEvPercent(fairProb, best.price);
        const fairPriceAmerican = fairProb === null ? null : probabilityToAmerican(fairProb);
        const status =
          fairProb !== null
            ? "EV available"
            : uniqueBooks.size < minBooks
              ? "Sparse coverage"
              : "Line shopping only";
        const label = [group.participant, group.team].filter(Boolean).join(" · ");
        const selectionBase = label || best.outcomeName;
        const selection = best.side ? `${selectionBase} ${best.outcomeName}` : selectionBase;
        const line = Number.isFinite(group.line) ? group.line : undefined;
        const query = new URLSearchParams({
          league: params.league,
          scope: "props",
          propType: params.propType
        });

        return [
          {
            id: `${group.key}|${sideKey}`,
            href: `/game/${encodeURIComponent(group.routeEventId)}?${query.toString()}`,
            event: group.eventLabel,
            eventMeta: group.marketLabel,
            startTime: group.commenceTime,
            market: group.marketLabel,
            marketMeta: line === undefined ? "Line shopping" : `Line ${line}`,
            selection,
            bestBook: best.bookTitle,
            bestBookKey: best.bookKey,
            bestPrice: best.price,
            line,
            bookCount: uniqueBooks.size,
            updatedAt: outcomes.map((outcome) => outcome.lastUpdate).sort().pop() ?? best.lastUpdate,
            status,
            evPct,
            fairPriceAmerican,
            confidence: fairProb !== null ? "EV available" : "Line shop"
          } satisfies PropBoardRow
        ];
      });
    })
    .sort((a, b) => {
      if (a.evPct !== null && b.evPct === null) return -1;
      if (a.evPct === null && b.evPct !== null) return 1;
      if (a.evPct !== null && b.evPct !== null && b.evPct !== a.evPct) return b.evPct - a.evPct;
      if (b.bookCount !== a.bookCount) return b.bookCount - a.bookCount;
      return Date.parse(a.startTime) - Date.parse(b.startTime);
    });
}

async function fetchPropsForEvent(params: {
  event: PropEventRef;
  propType: PropType;
  marketFamily: MarketFamily;
  markets: string[];
  regions: string;
  oddsFormat: string;
  books?: string[];
}): Promise<NormalizedPropOutcome[]> {
  const key = propsCacheKey({
    sportKey: params.event.sportKey,
    eventId: params.event.providerEventId,
    propType: params.propType,
    markets: params.markets,
    regions: params.regions,
    books: params.books,
    oddsFormat: params.oddsFormat
  });
  const cached = await cacheGet<NormalizedPropOutcome[]>(key);
  if (cached) return cached;

  const payload = await fetchEventOddsFromUpstream({
    sportKey: params.event.sportKey,
    eventId: params.event.providerEventId,
    regions: params.regions,
    markets: params.markets.join(","),
    oddsFormat: params.oddsFormat
  });
  const normalized = normalizePropOddsPayload({
    payload,
    event: params.event,
    markets: params.markets,
    marketFamily: params.marketFamily
  });
  await cacheSet(key, normalized, normalized.length ? PROP_TTL_MS : EMPTY_PROP_TTL_MS);
  return normalized;
}

export async function fetchPropsBoardData(params: {
  league: string;
  propType: PropType;
  events: PropEventRef[];
  regions?: string;
  oddsFormat?: string;
  maxEvents?: number;
  maxMarkets?: number;
  minBooks?: number;
  books?: string[];
}): Promise<PropsBoardData> {
  const resolution = resolveMarketRequest({
    scope: "props",
    propType: params.propType,
    league: params.league
  });
  if (resolution.fetchMode === "unsupported") {
    return {
      rows: [],
      emptyReason: resolution.emptyStateReason,
      marketFamily: resolution.marketFamily,
      propType: params.propType,
      fetchMode: resolution.fetchMode,
      requestedMarkets: [],
      failures: 0
    };
  }
  if (resolution.marketFamily === "main") {
    return {
      rows: [],
      marketFamily: resolution.marketFamily,
      propType: params.propType,
      fetchMode: resolution.fetchMode,
      requestedMarkets: resolution.markets,
      failures: 0
    };
  }

  const events = params.events
    .filter((event) => event.providerEventId)
    .slice(0, Math.max(1, params.maxEvents ?? DEFAULT_MAX_EVENTS));
  if (!events.length) {
    return {
      rows: [],
      emptyReason: "NO_EVENTS",
      marketFamily: resolution.marketFamily,
      propType: params.propType,
      fetchMode: resolution.fetchMode,
      requestedMarkets: resolution.markets,
      failures: 0
    };
  }

  const markets = cappedPropMarkets(resolution.markets, params.maxMarkets ?? 5);
  const results = await Promise.allSettled(
    events.map((event) =>
      fetchPropsForEvent({
        event,
        propType: params.propType,
        marketFamily: resolution.marketFamily,
        markets,
        regions: params.regions ?? "us",
        oddsFormat: params.oddsFormat ?? "american",
        books: params.books
      })
    )
  );

  const failures = results.filter((result) => result.status === "rejected").length;
  const outcomes = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  const rows = buildPropBoardRows({
    outcomes,
    league: params.league,
    propType: params.propType,
    minBooks: params.minBooks
  });
  return {
    rows,
    emptyReason: rows.length ? undefined : failures === results.length ? "API_ERROR" : "PROPS_SUPPORTED_BUT_NONE_AVAILABLE",
    marketFamily: resolution.marketFamily,
    propType: params.propType,
    fetchMode: resolution.fetchMode,
    requestedMarkets: markets,
    failures
  };
}

export function standardMarketKeys(markets: string[]): MarketKey[] {
  return markets.filter((market): market is MarketKey => market === "h2h" || market === "spreads" || market === "totals");
}
