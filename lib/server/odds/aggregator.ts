import type { MarketKey } from "@/lib/odds/schemas";
import { americanToProbability } from "@/lib/server/odds/fairMath";
import { toEventOddsList } from "@/lib/server/odds/normalize";
import type { EventOdds, FairEvent, FairOutcome, FairOutcomeBook } from "@/lib/server/odds/types";
import { getFairBoard, getNormalizedOdds } from "@/lib/server/odds/oddsService";
import { withOddsCache } from "@/lib/server/cache/oddsCache";

export type AggregatedSportsbookLine = {
  book: string;
  bookKey: string;
  odds: number;
  impliedProbability: number;
  noVigProbability: number;
  weight: number;
  edge: number;
  ev: number;
  point?: number;
  isBestPrice: boolean;
  lineMovement: number;
  movementArrow: "▲" | "▼" | "–";
  movementDirection: "up" | "down" | "flat";
};

export type AggregatedOutcome = {
  name: string;
  fairProbability: number;
  fairOdds: number;
  linePoint?: number;
  sportsbooks: AggregatedSportsbookLine[];
  bestLine: { book: string; bookKey: string; odds: number; point?: number } | null;
  bestEv: AggregatedSportsbookLine | null;
  edges: Array<{ book: string; edge: number; ev: number }>;
};

export type AggregatedGame = {
  id: string;
  game: string;
  sportKey: string;
  commenceTime: string;
  market: MarketKey;
  marketLabel: string;
  teams: { home: string; away: string };
  sides: AggregatedOutcome[];
  summary: {
    outcome: string;
    bestBook: string | null;
    bestOdds: number | null;
    fairOdds: number | null;
    fairProbability: number | null;
    ev: number;
    color: "green" | "yellow" | "grey";
  } | null;
};

export type AggregatedOddsResponse = {
  games: AggregatedGame[];
  updated: string;
  sportKey: string;
  market: MarketKey;
  marketLabel: string;
  rawEvents: EventOdds[];
};

type AggregatorParams = {
  sportKey?: string;
  market?: MarketKey;
  regions?: string;
  oddsFormat?: string;
  minBooks?: number;
};

const DEFAULT_SPORT = "basketball_nba";
const DEFAULT_MARKET: MarketKey = "h2h";
const AGGREGATOR_WINDOW_HOURS = 24;
const AGGREGATOR_HISTORY_HOURS = 24;
const AGGREGATOR_RETENTION_HOURS = 72;
const AGGREGATOR_DEFAULT_MIN_BOOKS = 4;

function marketLabel(market: MarketKey): string {
  switch (market) {
    case "spreads":
      return "spread";
    case "totals":
      return "total";
    default:
      return "moneyline";
  }
}

function evColor(ev: number): "green" | "yellow" | "grey" {
  if (ev >= 4) return "green";
  if (ev >= 1) return "yellow";
  if (ev > 0) return "yellow";
  return "grey";
}

function directionFromDelta(delta: number): "up" | "down" | "flat" {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}

function arrowForDirection(direction: "up" | "down" | "flat"): "▲" | "▼" | "–" {
  if (direction === "up") return "▲";
  if (direction === "down") return "▼";
  return "–";
}

function mapBookToLine(book: FairOutcomeBook): AggregatedSportsbookLine {
  const impliedProbability = americanToProbability(book.priceAmerican);
  const lineMovement = book.movement?.move ?? 0;
  const movementDirection = directionFromDelta(lineMovement);
  return {
    book: book.title,
    bookKey: book.bookKey,
    odds: book.priceAmerican,
    impliedProbability,
    noVigProbability: book.impliedProbNoVig,
    weight: book.weight,
    edge: book.edgePct,
    ev: book.evPct,
    point: book.point,
    isBestPrice: book.isBestPrice,
    lineMovement,
    movementDirection,
    movementArrow: arrowForDirection(movementDirection)
  };
}

function buildOutcome(event: FairEvent, outcome: FairOutcome): AggregatedOutcome {
  const sportsbooks = outcome.books.map(mapBookToLine);
  const bestLineEntry = sportsbooks.find((line) => line.isBestPrice) || sportsbooks[0] || null;
  const bestEv = sportsbooks.reduce<AggregatedSportsbookLine | null>((best, candidate) => {
    if (!best || candidate.ev > best.ev) return candidate;
    return best;
  }, null);
  const edges = sportsbooks
    .filter((line) => line.edge > 0)
    .map((line) => ({ book: line.book, edge: line.edge, ev: line.ev }));

  return {
    name: outcome.name,
    fairProbability: outcome.fairProb,
    fairOdds: outcome.fairAmerican,
    linePoint: event.linePoint,
    sportsbooks,
    bestLine: bestLineEntry
      ? {
          book: bestLineEntry.book,
          bookKey: bestLineEntry.bookKey,
          odds: bestLineEntry.odds,
          point: bestLineEntry.point
        }
      : null,
    bestEv,
    edges
  };
}

function buildSummary(game: AggregatedGame): AggregatedGame["summary"] {
  const ranked = game.sides
    .map((side) => ({ side, ev: side.bestEv?.ev ?? -Infinity }))
    .sort((a, b) => b.ev - a.ev);
  const best = ranked[0];
  if (!best || best.ev === -Infinity || !best.side) return null;

  return {
    outcome: best.side.name,
    bestBook: best.side.bestLine?.book ?? best.side.bestEv?.book ?? null,
    bestOdds: best.side.bestLine?.odds ?? best.side.bestEv?.odds ?? null,
    fairOdds: best.side.fairOdds,
    fairProbability: best.side.fairProbability,
    ev: best.ev,
    color: evColor(best.ev)
  };
}

export async function getAggregatedOdds(params: AggregatorParams = {}): Promise<AggregatedOddsResponse> {
  const sportKey = params.sportKey || DEFAULT_SPORT;
  const market: MarketKey = params.market || DEFAULT_MARKET;
  const regions = params.regions || "us";
  const oddsFormat = params.oddsFormat || "american";
  const minBooks = Number.isFinite(params.minBooks) ? Math.max(1, Math.floor(params.minBooks as number)) : AGGREGATOR_DEFAULT_MIN_BOOKS;

  return withOddsCache(
    ["aggregated", sportKey, market, regions, oddsFormat, `hist:${AGGREGATOR_HISTORY_HOURS}`, `win:${AGGREGATOR_WINDOW_HOURS}`],
    async () => {
      const normalized = await getNormalizedOdds({
        sportKey,
        regions,
        markets: market,
        oddsFormat
      });

      const fairBoard = await getFairBoard({
        market,
        model: "weighted",
        minBooks,
        windowHours: AGGREGATOR_WINDOW_HOURS,
        historyWindowHours: AGGREGATOR_HISTORY_HOURS,
        retentionHours: AGGREGATOR_RETENTION_HOURS,
        normalizedResult: normalized
      });

      const games: AggregatedGame[] = fairBoard.events.map((event) => {
        const sides = event.outcomes.map((outcome) => buildOutcome(event, outcome));
        const game: AggregatedGame = {
          id: event.id,
          game: `${event.awayTeam} @ ${event.homeTeam}`,
          sportKey: fairBoard.sportKey,
          commenceTime: event.commenceTime,
          market,
          marketLabel: marketLabel(market),
          teams: {
            home: event.homeTeam,
            away: event.awayTeam
          },
          sides,
          summary: null
        };
        game.summary = sides.length ? buildSummary(game) : null;
        return game;
      });

      games.sort((a, b) => Date.parse(a.commenceTime) - Date.parse(b.commenceTime));

      const rawEvents = toEventOddsList({ normalized: normalized.normalized, sportKey: normalized.sportKey });

      return {
        games,
        updated: fairBoard.updatedAt,
        sportKey: fairBoard.sportKey,
        market,
        marketLabel: marketLabel(market),
        rawEvents
      };
    },
    30_000
  );
}
