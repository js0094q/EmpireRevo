import { buildPickSummary } from "@/components/board/board-helpers";
import { filterEvents, pinnedEventMetrics, sortEvents, type SortKey } from "@/components/board/selectors";
import type { PriceValueDirection } from "@/lib/odds/priceValue";
import type { FairBoardResponse, FairEvent, FairOutcomeBook } from "@/lib/server/odds/types";
import { toEventRouteId } from "@/lib/server/odds/eventRoute";
import {
  formatAmericanOdds,
  formatBookCount,
  formatConfidenceLabel,
  formatLeagueLabel,
  formatLongStartTime,
  formatMarketLabel,
  formatSignedNumber,
  formatUpdatedLabel
} from "@/lib/ui/formatters/display";
import { getEvPresentation } from "@/lib/ui/evPresentation";

export type BoardSurfaceIntent = "board" | "games";
export type BoardSortValue = Extract<SortKey, "score" | "edge" | "ev" | "confidence" | "soonest" | "timing" | "book" | "coverage" | "pinned_score">;

export type BoardViewFilters = {
  search: string;
  sort: BoardSortValue;
  bookKey: string;
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
  bestPriceMeta: string | null;
  bestBook: string;
  bestBookKey: string | null;
  bestPinnedPrice: string | null;
  fairPrice: string;
  fairPriceMeta: string | null;
  priceSignal: string;
  priceSignalMeta: string;
  priceSignalTone: "positive" | "warning" | "neutral" | "danger";
  probabilityGap: string;
  probabilityGapValue: number;
  ev: string;
  evValue: number | null;
  evMeta: string | null;
  evTone: "positive" | "warning" | "neutral";
  confidence: string;
  confidenceDetail: string | null;
  confidenceBucket: "high" | "medium" | "low";
  books: string;
  booksValue: number;
  coverage: string;
  coverageMeta: string;
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
  resultLabel: string;
  coverageLabel: string;
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

function displayConfidenceLabel(label?: FairEvent["confidenceLabel"]): string {
  if (label === "High Confidence") return "High";
  if (label === "Moderate Confidence") return "Medium";
  if (label === "Limited Sharp Coverage") return "Sharp: Low";
  if (label === "Thin Market") return "Thin market";
  if (label === "Stale Market") return "Stale";
  return formatConfidenceLabel(label);
}

function confidenceDetail(label?: FairEvent["confidenceLabel"]): string | null {
  if (label === "Limited Sharp Coverage") return "Low sharp participation in the current consensus.";
  if (label === "Thin Market") return "Market quality is below the usual threshold.";
  if (label === "Stale Market") return "Odds feed freshness is degraded for this market.";
  return null;
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
  if (bestBook?.evReliability === "suppressed") return "No actionable edge";
  if (event.confidenceLabel === "Thin Market") return "Market quality low";
  if (event.confidenceLabel === "Limited Sharp Coverage") return "Low sharp participation";
  return null;
}

function priceSignal(direction: PriceValueDirection): {
  label: string;
  tone: BoardRowViewModel["priceSignalTone"];
} {
  if (direction === "better_than_fair") return { label: "Above consensus", tone: "positive" };
  if (direction === "worse_than_fair") return { label: "Below market", tone: "neutral" };
  return { label: "Market aligned", tone: "neutral" };
}

function priceSignalMeta(pick: ReturnType<typeof buildPickSummary>): string {
  if (pick.priceValueDirection === "worse_than_fair") return "Paying below fair";
  if (pick.priceValueDirection === "near_fair") return "No price gap";
  if (pick.opportunityStrength === "longshot_thin") return "Thin longshot";
  if (pick.opportunityStrength === "strong") return "Market advantage";
  return "Watch";
}

function formatEv(book: FairOutcomeBook | null): { value: string; numeric: number | null; meta: string | null } {
  if (!book) return { value: "—", numeric: null, meta: null };
  if (book.evReliability === "suppressed") return { value: "—", numeric: null, meta: "No actionable edge" };
  const numeric = Number.isFinite(book.evPct) ? book.evPct : null;
  const presentation = numeric === null ? null : getEvPresentation(numeric);
  return {
    value: formatSignedNumber(numeric, 2, "%"),
    numeric,
    meta: presentation?.label ?? "No edge detected"
  };
}

function coverageLabel(event: FairEvent): { value: string; meta: string } {
  if (event.totalBookCount > event.contributingBookCount && event.totalBookCount > 0) {
    return {
      value: `${event.contributingBookCount}/${event.totalBookCount}`,
      meta: "partial"
    };
  }
  return {
    value: formatBookCount(event.contributingBookCount),
    meta: event.marketPressureLabel || event.timingLabel
  };
}

function findPinnedPrice(event: FairEvent, pinnedBooks: Set<string>): string | null {
  if (!pinnedBooks.size) return null;
  const pick = buildPickSummary(event);
  const bookKey = pick.outcome.pinnedActionability.bestPinnedBookKey;
  if (!bookKey || !pinnedBooks.has(bookKey)) return null;
  const book = pick.outcome.books.find((entry) => entry.bookKey === bookKey) ?? null;
  if (!book) return null;
  return formatAmericanOdds(book.priceAmerican);
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
  const signal = priceSignal(pick.priceValueDirection);
  const evPresentation = bestBook?.evReliability === "suppressed" || bestBook?.evPct === undefined ? null : getEvPresentation(bestBook.evPct);
  const probabilityGapValue = Number.isFinite(pick.probabilityGapPct)
    ? pick.probabilityGapPct
    : Number.isFinite(bestBook?.edgePct)
      ? Number(bestBook?.edgePct)
      : 0;
  const ev = formatEv(bestBook);
  const evTone = evPresentation?.tone ?? "neutral";
  const coverage = coverageLabel(event);
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
    bestPrice: bestBook ? formatAmericanOdds(bestBook.priceAmerican) : formatAmericanOdds(pick.outcome.bestPrice),
    bestPriceMeta: bestBook ? "Book odds" : null,
    bestBook: bestBook?.title || pick.outcome.bestBook,
    bestBookKey: bestBook?.bookKey || null,
    bestPinnedPrice: findPinnedPrice(event, pinnedBooks),
    fairPrice: formatAmericanOdds(pick.outcome.fairAmerican),
    fairPriceMeta: "Consensus fair",
    priceSignal: signal.label,
    priceSignalMeta: priceSignalMeta(pick),
    priceSignalTone: signal.tone,
    probabilityGap: formatSignedNumber(probabilityGapValue, 2, "pp"),
    probabilityGapValue,
    ev: ev.value,
    evValue: ev.numeric,
    evMeta: ev.meta,
    evTone,
    confidence: displayConfidenceLabel(event.confidenceLabel),
    confidenceDetail: confidenceDetail(event.confidenceLabel),
    confidenceBucket: confidenceBucket(event.confidenceLabel),
    books: formatBookCount(event.contributingBookCount),
    booksValue: event.contributingBookCount,
    coverage: coverage.value,
    coverageMeta: coverage.meta,
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

  if (params.filters.bookKey && params.filters.bookKey !== "all") {
    events = events.filter((event) => buildPickSummary(event).book?.bookKey === params.filters.bookKey);
  }

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
        ? "Best price, fair odds, market gap, confidence, and book coverage."
        : "Event directory with direct paths into market detail.",
    updatedLabel: formatUpdatedLabel(params.board.updatedAt, params.board.lastUpdatedLabel),
    resultLabel: `${rows.length} ${params.mode === "board" ? (rows.length === 1 ? "market" : "markets") : rows.length === 1 ? "event" : "events"}`,
    coverageLabel: `${params.board.books.length} ${params.board.books.length === 1 ? "book" : "books"}`,
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
