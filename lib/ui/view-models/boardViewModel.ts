import { buildPickSummary, formatOffer } from "@/components/board/board-helpers";
import { filterEvents, pinnedEventMetrics, sortEvents, type SortKey } from "@/components/board/selectors";
import type { FairBoardResponse, FairEvent, FairOutcomeBook } from "@/lib/server/odds/types";
import { toEventRouteId } from "@/lib/server/odds/eventRoute";
import {
  formatAmericanOdds,
  formatBookCount,
  formatConfidenceLabel,
  formatLeagueLabel,
  formatLongStartTime,
  formatMarketLabel,
  formatUpdatedLabel
} from "@/lib/ui/formatters/display";

export type BoardSurfaceIntent = "board" | "games";
export type BoardSortValue = Extract<SortKey, "score" | "edge" | "confidence" | "soonest" | "timing" | "pinned_score">;

export type BoardViewFilters = {
  search: string;
  sort: BoardSortValue;
  edgeThresholdPct: number;
  minBooks: number;
  pinnedOnly: boolean;
  includeStale: boolean;
  pinnedBooks: Set<string>;
};

export type BoardRowViewModel = {
  id: string;
  href: string;
  event: string;
  eventMeta: string;
  startTime: string;
  market: string;
  marketMeta: string;
  bestPrice: string;
  bestBook: string;
  bestPinnedPrice: string | null;
  fairPrice: string;
  edge: string;
  edgeValue: number;
  confidence: string;
  confidenceBucket: "high" | "medium" | "low";
  books: string;
  booksValue: number;
  updated: string;
  isLive: boolean;
  isActionable: boolean;
  isStale: boolean;
  staleLabel: string | null;
  suppressionReason: string | null;
  marketStatus: string;
};

export type BoardViewModel = {
  title: string;
  subtitle: string;
  updatedLabel: string;
  rows: BoardRowViewModel[];
  books: Array<{ key: string; title: string; tier: string }>;
  emptyTitle: string;
  emptyMessage: string;
};

export type GameListGroupViewModel = {
  label: string;
  rows: BoardRowViewModel[];
};

function confidenceBucket(label?: FairEvent["confidenceLabel"]): "high" | "medium" | "low" {
  if (label === "High Confidence") return "high";
  if (label === "Moderate Confidence") return "medium";
  return "low";
}

function eventIsStale(event: FairEvent): boolean {
  if (event.confidenceLabel === "Stale Market") return true;
  if (event.staleStrength >= 0.55) return true;
  return event.outcomes.some((outcome) => outcome.books.some((book) => Boolean(book.staleActionable)));
}

function staleLabel(event: FairEvent): string | null {
  if (event.confidenceLabel === "Stale Market") return "Stale";
  if (event.staleStrength >= 0.55) return "Stale";
  const flagged = event.outcomes
    .flatMap((outcome) => outcome.books)
    .find((book) => Boolean(book.staleActionable));
  return flagged ? "Stale" : null;
}

function suppressionReason(event: FairEvent, bestBook: FairOutcomeBook | null): string | null {
  if (bestBook?.evReliability === "suppressed") return "Suppressed";
  if (event.confidenceLabel === "Thin Market") return "Thin";
  if (event.confidenceLabel === "Limited Sharp Coverage") return "Limited";
  return null;
}

function findPinnedPrice(event: FairEvent, pinnedBooks: Set<string>): string | null {
  if (!pinnedBooks.size) return null;
  const pick = buildPickSummary(event);
  const bookKey = pick.outcome.pinnedActionability.bestPinnedBookKey;
  if (!bookKey || !pinnedBooks.has(bookKey)) return null;
  const book = pick.outcome.books.find((entry) => entry.bookKey === bookKey) ?? null;
  if (!book) return null;
  return formatOffer(event.market, book);
}

function marketLabel(event: FairEvent): string {
  const pick = buildPickSummary(event);
  if (event.market === "h2h") return `${pick.outcome.name} ML`;
  const point = pick.book?.point ?? event.linePoint ?? pick.outcome.books[0]?.point;
  if (event.market === "totals") {
    return `${pick.outcome.name} ${Number.isFinite(point) ? point : ""}`.trim();
  }
  return `${pick.outcome.name} ${Number.isFinite(point) ? point : ""}`.trim();
}

function marketMeta(event: FairEvent): string {
  const pieces = [formatMarketLabel(event.market)];
  if (event.marketPressureLabel) pieces.push(event.marketPressureLabel);
  else if (event.timingLabel) pieces.push(event.timingLabel);
  return pieces.join(" · ");
}

function buildBoardRow(event: FairEvent, board: FairBoardResponse, league: string, model: "sharp" | "equal" | "weighted", mode: BoardSurfaceIntent, pinnedBooks: Set<string>): BoardRowViewModel {
  const pick = buildPickSummary(event);
  const bestBook = pick.book;
  const stale = eventIsStale(event);
  const eventHref = new URLSearchParams({
    league,
    market: event.market,
    model
  });
  if (mode === "games") eventHref.set("mode", "games");

  return {
    id: event.id,
    href: `/game/${encodeURIComponent(toEventRouteId(event))}?${eventHref.toString()}`,
    event: `${event.awayTeam} at ${event.homeTeam}`,
    eventMeta: `${formatLeagueLabel(board.league)} · ${formatLongStartTime(event.commenceTime)}`,
    startTime: formatLongStartTime(event.commenceTime),
    market: marketLabel(event),
    marketMeta: marketMeta(event),
    bestPrice: bestBook ? formatOffer(event.market, bestBook) : formatAmericanOdds(pick.outcome.bestPrice),
    bestBook: bestBook?.title || pick.outcome.bestBook,
    bestPinnedPrice: findPinnedPrice(event, pinnedBooks),
    fairPrice: formatOffer(event.market, pick.outcome),
    edge: `${pick.book?.edgePct && pick.book.edgePct > 0 ? "+" : ""}${(pick.book?.edgePct ?? 0).toFixed(2)}%`,
    edgeValue: pick.book?.edgePct ?? 0,
    confidence: formatConfidenceLabel(event.confidenceLabel),
    confidenceBucket: confidenceBucket(event.confidenceLabel),
    books: formatBookCount(event.contributingBookCount),
    booksValue: event.contributingBookCount,
    updated: formatUpdatedLabel(bestBook?.lastUpdate || board.updatedAt),
    isLive: Date.parse(event.commenceTime) <= Date.now(),
    isActionable: pick.hasRecommendation && bestBook?.evReliability !== "suppressed",
    isStale: stale,
    staleLabel: staleLabel(event),
    suppressionReason: suppressionReason(event, bestBook),
    marketStatus: stale ? "Stale" : event.timingLabel
  };
}

export function buildBoardViewModel(params: {
  board: FairBoardResponse;
  league: string;
  model: "sharp" | "equal" | "weighted";
  mode: BoardSurfaceIntent;
  filters: BoardViewFilters;
}): BoardViewModel {
  const visibleBookKeys = new Set(params.board.books.map((book) => book.key));
  let events = filterEvents(params.board.events, {
    teamQuery: params.filters.search,
    visibleBookKeys,
    edgeThresholdPct: params.filters.edgeThresholdPct,
    minContributingBooks: params.filters.minBooks,
    minConfidenceScore: 0,
    minSharpParticipation: 0,
    startWindow: "all",
    positiveEdgeOnly: false,
    sideFilter: "all",
    bestEdgesOnly: false,
    staleOnly: false,
    highCoverageOnly: false,
    trustedBooksOnly: false,
    pinnedOnly: params.filters.pinnedOnly,
    pinnedBooks: params.filters.pinnedBooks
  });

  if (!params.filters.includeStale) {
    events = events.filter((event) => !eventIsStale(event));
  }

  events = sortEvents(events, params.filters.sort, {
    pinnedBooks: params.filters.pinnedBooks,
    pinnedActionableEdgeThreshold: Math.max(0.5, params.filters.edgeThresholdPct)
  });

  const rows = events.map((event) =>
    buildBoardRow(event, params.board, params.league, params.model, params.mode, params.filters.pinnedBooks)
  );

  return {
    title: params.mode === "board" ? "Board" : "Games",
    subtitle:
      params.mode === "board"
        ? "Scan ranked markets by best line against fair value."
        : "Browse live and upcoming events with direct paths into market detail.",
    updatedLabel: formatUpdatedLabel(params.board.updatedAt, params.board.lastUpdatedLabel),
    rows,
    books: params.board.books,
    emptyTitle: "No qualifying markets for current filters.",
    emptyMessage: params.mode === "board" ? "Adjust filters or include stale markets." : "Try another league, market, or filter set."
  };
}

export function buildGamesGroups(rows: BoardRowViewModel[]): GameListGroupViewModel[] {
  const groups = new Map<string, BoardRowViewModel[]>();
  for (const row of rows) {
    const key = row.eventMeta.split(" · ")[1] || row.eventMeta;
    const existing = groups.get(key) || [];
    existing.push(row);
    groups.set(key, existing);
  }
  return Array.from(groups.entries()).map(([label, groupRows]) => ({
    label,
    rows: groupRows
  }));
}

export function buildPinnedBooksPreferenceLabel(board: FairBoardResponse, pinnedBooks: Set<string>): string {
  if (!pinnedBooks.size) return "All books";
  const labels = board.books.filter((book) => pinnedBooks.has(book.key)).map((book) => book.title);
  if (!labels.length) return "All books";
  return labels.join(", ");
}

export function pinnedActionableScore(event: FairEvent, pinnedBooks: Set<string>): number {
  return pinnedEventMetrics(event, pinnedBooks).bestScore;
}
