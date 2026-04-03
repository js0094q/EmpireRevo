import type { MarketKey } from "@/lib/odds/schemas";
import type { BoardDrilldownRow, ExpandedMarket, FairBoardResponse, FairEvent, FairOutcome, FairOutcomeBook } from "@/lib/server/odds/types";
import { americanToDecimal, americanToProbability } from "@/lib/server/odds/fairMath";
import { compareOffersByMarket } from "@/lib/server/odds/marketCompare";

const MARKET_PROBABILITY_TOLERANCE = 0.001;

type BoardCandidate = {
  row: BoardDrilldownRow;
  commenceMs: number;
  valuePer100: number;
  marketFairOdds: number;
  booksInConsensus: number;
};

function isComparableEvent(event: FairEvent, minBooks: number): boolean {
  return event.contributingBookCount >= minBooks;
}

function asLiveStatus(commenceMs: number, nowMs: number): boolean {
  if (!Number.isFinite(commenceMs)) return false;
  return commenceMs <= nowMs;
}

function formatPoint(point?: number): string {
  if (!Number.isFinite(point)) return "";
  const rounded = Number(point);
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

function formatBoardMarket(params: {
  market: MarketKey;
  outcomeName: string;
  linePoint?: number;
}): string {
  if (params.market === "h2h") {
    return `${params.outcomeName} ML`;
  }
  if (params.market === "totals") {
    const label = params.outcomeName.toLowerCase().startsWith("u") ? "Under" : "Over";
    return `${label} ${formatPoint(params.linePoint)}`.trim();
  }
  return `${params.outcomeName} ${formatPoint(params.linePoint)}`.trim();
}

function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function positionFromMarket(impliedProbability: number, marketFairProbability: number): "above_market" | "at_market" | "below_market" {
  const diff = impliedProbability - marketFairProbability;
  if (Math.abs(diff) <= MARKET_PROBABILITY_TOLERANCE) return "at_market";
  return diff > 0 ? "above_market" : "below_market";
}

function offerPoint(outcome: FairOutcomeBook, fallbackPoint?: number): number | undefined {
  if (Number.isFinite(outcome.point)) return Number(outcome.point);
  if (Number.isFinite(fallbackPoint)) return Number(fallbackPoint);
  return undefined;
}

function sortByBestOffer(market: MarketKey, outcomeName: string) {
  return (a: FairOutcomeBook, b: FairOutcomeBook): number =>
    compareOffersByMarket(
      market,
      outcomeName,
      { point: offerPoint(a), priceAmerican: a.priceAmerican },
      { point: offerPoint(b), priceAmerican: b.priceAmerican }
    );
}

function selectBestOffer(market: MarketKey, outcomeName: string, books: FairOutcomeBook[]): FairOutcomeBook | null {
  let bestOffer: FairOutcomeBook | null = null;
  for (const book of books) {
    if (!bestOffer) {
      bestOffer = book;
      continue;
    }

    if (
      compareOffersByMarket(
        market,
        outcomeName,
        { point: offerPoint(bestOffer), priceAmerican: bestOffer.priceAmerican },
        { point: offerPoint(book), priceAmerican: book.priceAmerican }
      ) > 0
    ) {
      bestOffer = book;
    }
  }

  return bestOffer;
}

function selectBestOutcome(event: FairEvent): { outcome: FairOutcome; bestOffer: FairOutcomeBook } | null {
  let bestOutcome: FairOutcome | null = null;
  let bestOffer: FairOutcomeBook | null = null;
  let bestValuePer100 = Number.NEGATIVE_INFINITY;

  for (const outcome of event.outcomes) {
    const candidateBestOffer = selectBestOffer(event.market, outcome.name, outcome.books);
    if (!candidateBestOffer) continue;

    const fairDecimal = americanToDecimal(outcome.fairAmerican);
    const offerDecimal = americanToDecimal(candidateBestOffer.priceAmerican);
    const candidateValue = Number.isFinite(offerDecimal) && Number.isFinite(fairDecimal) ? round2((offerDecimal - fairDecimal) * 100) : 0;
    if (bestOutcome) {
      if (candidateValue < bestValuePer100) continue;
      if (candidateValue === bestValuePer100) {
        const currentBestPrice = bestOffer?.priceAmerican ?? Number.NEGATIVE_INFINITY;
        if (candidateBestOffer.priceAmerican <= currentBestPrice) continue;
      }
    }

    bestOutcome = outcome;
    bestOffer = candidateBestOffer;
    bestValuePer100 = candidateValue;
  }

  if (!bestOutcome || !bestOffer) return null;
  return { outcome: bestOutcome, bestOffer };
}

function buildExpandedMarket(event: FairEvent, outcome: FairOutcome): ExpandedMarket {
  const weightedMarketFairProbability = outcome.fairProb;
  const weightedMarketFairOdds = outcome.fairAmerican;
  const weightedMarketFairDecimal = americanToDecimal(outcome.fairAmerican);
  const booksInConsensus = outcome.books.length;
  const totalWeight = outcome.books.reduce((sum, book) => sum + (Number.isFinite(book.weight) ? Math.max(0, Number(book.weight)) : 0), 0);

  const offers = [...outcome.books]
    .sort(sortByBestOffer(event.market, outcome.name))
    .map((book) => {
      const decimalOdds = americanToDecimal(book.priceAmerican);
      const impliedProbability = americanToProbability(book.priceAmerican);
      const devigProbability = Number.isFinite(book.impliedProbNoVig) ? book.impliedProbNoVig : impliedProbability;
      const probabilityDiffVsMarket = round2((devigProbability - weightedMarketFairProbability) * 100);
      const valueDelta = Number.isFinite(decimalOdds) && Number.isFinite(weightedMarketFairDecimal)
        ? round2((decimalOdds - weightedMarketFairDecimal) * 100)
        : 0;
      return {
        book: book.title,
        americanOdds: book.priceAmerican,
        decimalOdds: round2(decimalOdds),
        impliedProbability,
        devigProbability,
        probabilityDiffVsMarket,
        valuePer100: valueDelta,
        position: positionFromMarket(impliedProbability, weightedMarketFairProbability)
      };
    });

  return {
    weightedMarketFairProbability,
    weightedMarketFairOdds,
    weightedMarketFairDecimal,
    booksInConsensus,
    totalWeight: round2(totalWeight),
    offers
  };
}

function buildRowForEvent(event: FairEvent, nowMs: number, minBooks: number): BoardCandidate | null {
  const selected = selectBestOutcome(event);
  if (!selected) return null;
  const { outcome: chosenOutcome, bestOffer } = selected;
  const fairDecimal = americanToDecimal(chosenOutcome.fairAmerican);
  const bestDecimal = americanToDecimal(bestOffer.priceAmerican);
  const boardMarket = formatBoardMarket({
    market: event.market,
    outcomeName: chosenOutcome.name,
    linePoint: event.linePoint
  });
  const commenceMs = Date.parse(event.commenceTime);
  const valuePer100 = Number.isFinite(bestDecimal) && Number.isFinite(fairDecimal) ? round2((bestDecimal - fairDecimal) * 100) : 0;

  return {
    commenceMs,
    valuePer100,
    marketFairOdds: chosenOutcome.fairAmerican,
    booksInConsensus: chosenOutcome.books.length,
    row: {
      id: `${event.id}:${chosenOutcome.name}`,
      baseEventId: event.baseEventId,
      commenceTime: event.commenceTime,
      isLive: asLiveStatus(commenceMs, nowMs),
      event: `${event.awayTeam} vs ${event.homeTeam}`,
      market: boardMarket,
      bestBook: bestOffer.title,
      bestOdds: bestOffer.priceAmerican,
      marketFairOdds: chosenOutcome.fairAmerican,
      valuePer100,
      booksInConsensus: chosenOutcome.books.length,
      confidenceLabel: event.confidenceLabel,
      coverageBooks: chosenOutcome.books.length,
      coverageRequiredBooks: minBooks,
      expanded: buildExpandedMarket(event, chosenOutcome)
    }
  };
}

export function buildBoardDrilldownRows(board: FairBoardResponse, options?: { minBooks?: number }): BoardDrilldownRow[] {
  const minBooks = Math.max(1, options?.minBooks ?? 3);
  const nowMs = Date.now();
  return board.events
    .filter((event) => isComparableEvent(event, minBooks))
    .map((event) => buildRowForEvent(event, nowMs, minBooks))
    .filter((row): row is BoardCandidate => Boolean(row))
    .sort((a, b) => {
      const valueDiff = b.valuePer100 - a.valuePer100;
      if (valueDiff) return valueDiff;
      const timeDiff = a.commenceMs - b.commenceMs;
      if (timeDiff) return timeDiff;
      const fairDiff = b.marketFairOdds - a.marketFairOdds;
      if (fairDiff) return fairDiff;
      return b.booksInConsensus - a.booksInConsensus;
    })
    .map((candidate) => candidate.row);
}
