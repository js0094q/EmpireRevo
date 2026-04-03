import type { DerivedGame, DerivedMarket, DerivedSide, DriverRef, EventRef, LeagueKey, MarketKey } from "@/lib/odds/schemas";
import type { FairBoardResponse, FairEvent, FairOutcome, FairOutcomeBook } from "@/lib/server/odds/types";

const MARKET_ORDER: Record<MarketKey, number> = {
  h2h: 0,
  spreads: 1,
  totals: 2
};

function slugId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleVariance(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = average(values);
  const squares = values.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  return squares / (values.length - 1);
}

function weightedAverage(entries: Array<{ probability: number; weight: number }>): number {
  const totalWeight = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (totalWeight <= 0) {
    return average(entries.map((entry) => entry.probability));
  }
  return entries.reduce((sum, entry) => sum + entry.probability * Math.max(0, entry.weight), 0) / totalWeight;
}

function latestUpdateMs(books: FairOutcomeBook[]): number {
  return books.reduce((latest, book) => {
    const parsed = Date.parse(book.lastUpdate || "");
    if (!Number.isFinite(parsed)) return latest;
    return Math.max(latest, parsed);
  }, 0);
}

function movementIcon(delta?: number): DerivedSide["movement"]["icon"] {
  if (!Number.isFinite(delta)) return "flat";
  if (Math.abs(Number(delta)) >= 15) return "bolt";
  if (Number(delta) > 0) return "up";
  if (Number(delta) < 0) return "down";
  return "flat";
}

function legacyConfidence(label: FairOutcome["confidenceLabel"]): DerivedSide["confidence"] {
  if (label === "High Confidence") return "High";
  if (label === "Moderate Confidence") return "Medium";
  return "Low";
}

function bestPriceBook(outcome: FairOutcome): FairOutcomeBook | null {
  return outcome.books.find((book) => book.isBestPrice) ?? outcome.books[0] ?? null;
}

function topDrivers(outcome: FairOutcome): DriverRef[] {
  const sharpBooks = outcome.books.filter((book) => book.isSharpBook);
  const source = sharpBooks.length ? sharpBooks : outcome.books;
  return [...source]
    .sort((a, b) => b.weight * b.impliedProbNoVig - a.weight * a.impliedProbNoVig)
    .slice(0, 3)
    .map((book) => ({
      bookKey: book.bookKey,
      bookTitle: book.title,
      weight: book.weight
    }));
}

function buildExplain(outcome: FairOutcome): DerivedSide["explain"] {
  const probabilities = outcome.books
    .map((book) => book.impliedProbNoVig)
    .filter((probability) => Number.isFinite(probability));
  const equalWeightedProb = average(probabilities);
  const sharpBooks = outcome.books.filter((book) => book.isSharpBook);
  const sharpSource = sharpBooks.length ? sharpBooks : outcome.books;
  const sharpWeightedProb = weightedAverage(
    sharpSource.map((book) => ({
      probability: book.impliedProbNoVig,
      weight: book.weight
    }))
  );
  const latestBookUpdate = latestUpdateMs(outcome.books);
  const recencySec = latestBookUpdate ? Math.max(0, Math.floor((Date.now() - latestBookUpdate) / 1000)) : 9999;
  const variance = sampleVariance(probabilities);
  const drivers = topDrivers(outcome);

  return {
    equalWeightedProb,
    sharpWeightedProb,
    leanPct: (sharpWeightedProb - equalWeightedProb) * 100,
    bookCount: outcome.books.length,
    variance,
    recencySec,
    topDrivers: drivers
  };
}

function buildDerivedSide(outcome: FairOutcome): DerivedSide {
  const bestBook = bestPriceBook(outcome);
  const explain = buildExplain(outcome);

  return {
    label: outcome.name,
    bestPrice: {
      bookKey: bestBook?.bookKey ?? "",
      bookTitle: bestBook?.title ?? "",
      price: bestBook?.priceAmerican ?? 0
    },
    consensusProb: outcome.fairProb,
    fairProb: outcome.fairProb,
    evPct: bestBook?.evQualified ? bestBook.evPct : 0,
    confidence: legacyConfidence(outcome.confidenceLabel),
    confidenceWhy: {
      books: outcome.books.length,
      variance: explain.variance,
      recencySec: explain.recencySec
    },
    leanPct: explain.leanPct,
    sharpDrivers: explain.topDrivers,
    explain,
    movement: bestBook?.movement
      ? {
          openPrice: bestBook.movement.openPrice,
          currentPrice: bestBook.movement.currentPrice,
          prevPrice: bestBook.movement.prevPrice,
          deltaCents: bestBook.movement.delta,
          moveCents: bestBook.movement.move,
          icon: movementIcon(bestBook.movement.delta)
        }
      : {
          currentPrice: bestBook?.priceAmerican,
          icon: "flat"
        }
  };
}

function deriveEventStatus(commenceTime: string, nowMs: number): EventRef["status"] {
  const kickoffMs = Date.parse(commenceTime);
  if (!Number.isFinite(kickoffMs)) return "upcoming";
  return kickoffMs <= nowMs ? "live" : "upcoming";
}

function compareMarketEvents(a: FairEvent, b: FairEvent): number {
  const aPoint = Number(a.linePoint);
  const bPoint = Number(b.linePoint);
  const aHasPoint = Number.isFinite(aPoint);
  const bHasPoint = Number.isFinite(bPoint);
  if (aHasPoint && bHasPoint && aPoint !== bPoint) return aPoint - bPoint;
  if (aHasPoint !== bHasPoint) return aHasPoint ? -1 : 1;
  return a.id.localeCompare(b.id);
}

function selectRepresentativeEvents(boards: FairBoardResponse[]): Map<string, { template: FairEvent; markets: Map<MarketKey, FairEvent[]> }> {
  const grouped = new Map<string, { template: FairEvent; markets: Map<MarketKey, FairEvent[]> }>();

  for (const board of boards) {
    for (const event of board.events) {
      const key = event.baseEventId;
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          template: event,
          markets: new Map([[event.market, [event]]])
        });
        continue;
      }

      const marketEvents = existing.markets.get(event.market) ?? [];
      if (!marketEvents.some((candidate) => candidate.id === event.id)) {
        marketEvents.push(event);
        existing.markets.set(event.market, marketEvents);
      }
    }
  }

  return grouped;
}

export function buildLegacyBoardGames(params: {
  boards: FairBoardResponse[];
  league: LeagueKey;
  fallbackUpdatedAt: string;
}): DerivedGame[] {
  const groups = selectRepresentativeEvents(params.boards);
  const nowMs = Date.now();

  return Array.from(groups.values())
    .map(({ template, markets }) => {
      const derivedMarkets = Array.from(markets.entries())
        .sort(([a], [b]) => MARKET_ORDER[a] - MARKET_ORDER[b])
        .flatMap(([marketKey, marketEvents]) =>
          [...marketEvents]
            .sort(compareMarketEvents)
            .map<DerivedMarket>((event) => ({
              market: marketKey,
              linePoint: Number.isFinite(Number(event.linePoint)) ? Number(event.linePoint) : undefined,
              sides: event.outcomes.map(buildDerivedSide).sort((a, b) => b.evPct - a.evPct)
            }))
        );

      let marketUpdatedMs = 0;
      for (const marketEvents of markets.values()) {
        for (const event of marketEvents) {
          for (const outcome of event.outcomes) {
            marketUpdatedMs = Math.max(marketUpdatedMs, latestUpdateMs(outcome.books));
          }
        }
      }
      const updatedAt = marketUpdatedMs ? new Date(marketUpdatedMs).toISOString() : params.fallbackUpdatedAt;

      return {
        event: {
          id: template.baseEventId,
          league: params.league,
          commenceTime: template.commenceTime,
          home: {
            id: slugId(template.homeTeam),
            name: template.homeTeam,
            logoUrl: template.homeLogoUrl
          },
          away: {
            id: slugId(template.awayTeam),
            name: template.awayTeam,
            logoUrl: template.awayLogoUrl
          },
          status: deriveEventStatus(template.commenceTime, nowMs)
        },
        markets: derivedMarkets,
        updatedAt
      };
    })
    .sort((a, b) => Date.parse(a.event.commenceTime) - Date.parse(b.event.commenceTime));
}

export function latestBoardUpdatedAt(boards: FairBoardResponse[], fallback: string): string {
  const latest = boards.reduce((max, board) => {
    const parsed = Date.parse(board.updatedAt);
    if (!Number.isFinite(parsed)) return max;
    return Math.max(max, parsed);
  }, 0);
  return latest ? new Date(latest).toISOString() : fallback;
}
