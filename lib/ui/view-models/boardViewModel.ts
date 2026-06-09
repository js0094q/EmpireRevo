import { buildPickSummary } from "@/components/board/board-helpers";
import { filterEvents, pinnedEventMetrics, sortEvents, type SortKey } from "@/components/board/selectors";
import type { PriceValueDirection } from "@/lib/odds/priceValue";
import type { FairBoardResponse, FairEvent, FairOutcomeBook, OutcomeResult, PersistedOutcomeResult } from "@/lib/server/odds/types";
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

export type BoardSurfaceIntent = "board";
export type BoardSortValue = Extract<SortKey, "score" | "edge" | "ev" | "confidence" | "soonest" | "timing" | "book" | "coverage" | "pinned_score" | "best"> | "outcome";
export type BoardConfidenceFilter = "all" | "high" | "medium" | "low";
export type BoardOutcomeFilter = "all" | "pending" | OutcomeResult;

export type BoardViewFilters = {
  search: string;
  sort: BoardSortValue;
  bookKey: string;
  edgeThresholdPct: number;
  minBooks: number;
  confidence: BoardConfidenceFilter;
  outcomeStatus: BoardOutcomeFilter;
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
  selection: string;
  outcomeLabel: string;
  outcomeTone: "positive" | "warning" | "neutral" | "danger";
  outcomeResult: OutcomeResult | null;
  bestPrice: string;
  bestPriceMeta: string | null;
  bestBook: string;
  bestBookAbbrev: string;
  bestBookKey: string | null;
  bestPinnedPrice: string | null;
  pinnedAvailability: string;
  pinnedAvailabilityTone: "positive" | "warning" | "neutral";
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
  whySignal: Array<{ label: string; value: string }>;
};

export type BoardViewModel = {
  title: string;
  subtitle: string;
  updatedLabel: string;
  resultLabel: string;
  coverageLabel: string;
  statusItems: Array<{ label: string; value: string; tone?: "positive" | "warning" | "neutral" }>;
  staleExcludedCount: number;
  rows: BoardRowViewModel[];
  books: Array<{ key: string; title: string; tier: string }>;
  emptyTitle: string;
  emptyMessage: string;
};

function confidenceBucket(label?: FairEvent["confidenceLabel"]): "high" | "medium" | "low" {
  if (label === "High Confidence") return "high";
  if (label === "Moderate Confidence") return "medium";
  return "low";
}

function sanitizeKeySegment(value: string | null | undefined): string {
  const sanitized = (value || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return sanitized || "unknown";
}

function outcomeMarketKey(event: FairEvent, outcomeName: string): string {
  return `${sanitizeKeySegment(event.market)}:${sanitizeKeySegment(outcomeName)}`;
}

function normalizeLookupPart(value: string | null | undefined): string {
  const normalized = (value || "unknown").trim().toLowerCase();
  return normalized || "unknown";
}

function outcomeLookupKey(event: FairEvent, outcomeName: string): string {
  return `${normalizeLookupPart(event.sportKey)}:${normalizeLookupPart(event.id)}:${outcomeMarketKey(event, outcomeName)}:${normalizeLookupPart(outcomeName)}`;
}

function buildOutcomeMap(outcomes: PersistedOutcomeResult[] | undefined): Map<string, PersistedOutcomeResult> {
  const map = new Map<string, PersistedOutcomeResult>();
  for (const outcome of outcomes || []) {
    map.set(outcome.id, outcome);
  }
  return map;
}

function outcomePresentation(result: OutcomeResult | null | undefined): {
  label: string;
  tone: BoardRowViewModel["outcomeTone"];
} {
  if (result === "win") return { label: "Win", tone: "positive" };
  if (result === "loss") return { label: "Loss", tone: "danger" };
  if (result === "push") return { label: "Push", tone: "neutral" };
  if (result === "void") return { label: "Void", tone: "neutral" };
  if (result === "unknown") return { label: "Unknown", tone: "warning" };
  return { label: "Pending", tone: "neutral" };
}

function minConfidenceScore(filter: BoardConfidenceFilter): number {
  if (filter === "high") return 0.75;
  if (filter === "medium") return 0.55;
  return 0;
}

function eventMeetsConfidenceFilter(event: FairEvent, filter: BoardConfidenceFilter): boolean {
  if (filter === "all") return true;
  if (filter === "low") return event.confidenceScore < 0.55 || event.confidenceLabel === "Thin Market" || event.confidenceLabel === "Limited Sharp Coverage";
  return event.confidenceScore >= minConfidenceScore(filter);
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
  if (eventIsHistorical(event)) return true;
  if (event.confidenceLabel === "Stale Market") return true;
  if (event.staleStrength >= 0.55) return true;
  return event.outcomes.some((outcome) => outcome.books.some((book) => Boolean(book.staleActionable)));
}

function staleLabel(event: FairEvent): string | null {
  if (eventIsHistorical(event)) return "Historical";
  if (event.confidenceLabel === "Stale Market") return "Stale";
  if (event.staleStrength >= 0.55) return "Stale";
  const flagged = event.outcomes
    .flatMap((outcome) => outcome.books)
    .find((book) => Boolean(book.staleActionable));
  return flagged ? "Stale" : null;
}

function eventAgeHours(event: FairEvent): number | null {
  const commenceMs = Date.parse(event.commenceTime);
  if (!Number.isFinite(commenceMs)) return null;
  return (Date.now() - commenceMs) / (60 * 60 * 1000);
}

function eventIsHistorical(event: FairEvent): boolean {
  const ageHours = eventAgeHours(event);
  return ageHours !== null && ageHours > 8;
}

function eventStatusLabel(event: FairEvent, stale: boolean): string {
  if (eventIsHistorical(event)) return "Historical";
  const ageHours = eventAgeHours(event);
  if (ageHours !== null && ageHours >= 0) return "In progress";
  if (stale) return "Stale";
  return event.timingLabel;
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

function pinnedAvailability(event: FairEvent, pinnedBooks: Set<string>): {
  label: string;
  tone: BoardRowViewModel["pinnedAvailabilityTone"];
} {
  if (!pinnedBooks.size) return { label: "No pinned set", tone: "neutral" };
  const pick = buildPickSummary(event);
  if (pick.outcome.pinnedActionability.actionable) return { label: "Pinned available", tone: "positive" };
  if (pick.outcome.pinnedActionability.globalPriceAvailableInPinned) return { label: "Pinned matches", tone: "neutral" };
  return { label: "Not at pinned", tone: "warning" };
}

function abbreviateBook(title: string): string {
  const words = title
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .split(" ")
    .filter(Boolean);
  if (!words.length) return "—";
  if (words.length === 1) return words[0]!.slice(0, 4).toUpperCase();
  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function selectionLabel(event: FairEvent, outcomeName: string): string {
  if (event.market === "h2h") return `${outcomeName} ML`;
  const outcome = event.outcomes.find((entry) => entry.name === outcomeName) ?? event.outcomes[0];
  const point = outcome?.books[0]?.point ?? event.linePoint;
  if (event.market === "totals") {
    return `${outcomeName} ${Number.isFinite(point) ? point : ""}`.trim();
  }
  return `${outcomeName} ${Number.isFinite(point) ? point : ""}`.trim();
}

function marketMeta(event: FairEvent): string {
  const pieces = [formatMarketLabel(event.market)];
  if (event.marketPressureLabel) pieces.push(event.marketPressureLabel);
  else if (event.timingLabel) pieces.push(event.timingLabel);
  return pieces.join(" · ");
}

function buildBoardRow(
  event: FairEvent,
  board: FairBoardResponse,
  league: string,
  model: "sharp" | "equal" | "weighted",
  pinnedBooks: Set<string>,
  outcomes: Map<string, PersistedOutcomeResult>
): BoardRowViewModel {
  const pick = buildPickSummary(event);
  const bestBook = pick.book;
  const persistedOutcome = outcomes.get(outcomeLookupKey(event, pick.outcome.name)) ?? null;
  const outcome = outcomePresentation(persistedOutcome?.result ?? null);
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
  const pinned = pinnedAvailability(event, pinnedBooks);
  const eventHref = new URLSearchParams({
    league,
    market: event.market,
    model
  });

  return {
    id: event.id,
    href: `/game/${encodeURIComponent(toEventRouteId(event))}?${eventHref.toString()}`,
    event: `${event.awayTeam} at ${event.homeTeam}`,
    eventMeta: `${formatLeagueLabel(board.league)} · ${formatLongStartTime(event.commenceTime)}`,
    startTime: formatLongStartTime(event.commenceTime),
    market: formatMarketLabel(event.market),
    marketMeta: marketMeta(event),
    selection: selectionLabel(event, pick.outcome.name),
    outcomeLabel: outcome.label,
    outcomeTone: outcome.tone,
    outcomeResult: persistedOutcome?.result ?? null,
    bestPrice: bestBook ? formatAmericanOdds(bestBook.priceAmerican) : formatAmericanOdds(pick.outcome.bestPrice),
    bestPriceMeta: bestBook ? "Book odds" : null,
    bestBook: bestBook?.title || pick.outcome.bestBook,
    bestBookAbbrev: abbreviateBook(bestBook?.title || pick.outcome.bestBook),
    bestBookKey: bestBook?.bookKey || null,
    bestPinnedPrice: findPinnedPrice(event, pinnedBooks),
    pinnedAvailability: pinned.label,
    pinnedAvailabilityTone: pinned.tone,
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
    marketStatus: eventStatusLabel(event, stale),
    whySignal: [
      { label: "Best available price", value: bestBook ? `${formatAmericanOdds(bestBook.priceAmerican)} at ${bestBook.title}` : "Unavailable" },
      { label: "Consensus fair", value: formatAmericanOdds(pick.outcome.fairAmerican) },
      { label: "Gap", value: formatSignedNumber(probabilityGapValue, 2, "pp") },
      { label: "EV", value: ev.value },
      { label: "Coverage", value: `${formatBookCount(event.contributingBookCount)} of ${formatBookCount(event.totalBookCount)}` },
      { label: "Freshness", value: formatUpdatedLabel(bestBook?.lastUpdate || board.updatedAt) },
      { label: "Sharp signal", value: displayConfidenceLabel(event.confidenceLabel) },
      { label: "Result", value: ev.meta ?? "Market aligned" }
    ]
  };
}

function uniqueEventCount(events: FairEvent[]): number {
  return new Set(events.map((event) => event.baseEventId || event.id)).size;
}

function latestOddsUpdate(events: FairEvent[], fallback: string): string {
  const updates = events
    .flatMap((event) => event.outcomes.flatMap((outcome) => outcome.books.map((book) => book.lastUpdate).filter(Boolean)))
    .map((value) => Date.parse(value as string))
    .filter((value) => Number.isFinite(value));
  if (!updates.length) return fallback;
  return new Date(Math.max(...updates)).toISOString();
}

export function buildBoardViewModel(params: {
  board: FairBoardResponse;
  league: string;
  model: "sharp" | "equal" | "weighted";
  mode: BoardSurfaceIntent;
  filters: BoardViewFilters;
  outcomes?: PersistedOutcomeResult[];
}): BoardViewModel {
  const visibleBookKeys = new Set(params.board.books.map((book) => book.key));
  const outcomeMap = buildOutcomeMap(params.outcomes);
  const staleEventsBeforeFilters = params.board.events.filter(eventIsStale);
  let events = filterEvents(params.board.events, {
    teamQuery: params.filters.search,
    visibleBookKeys,
    edgeThresholdPct: 0,
    minContributingBooks: params.filters.minBooks,
    minConfidenceScore: minConfidenceScore(params.filters.confidence),
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

  events = events.filter((event) => eventMeetsConfidenceFilter(event, params.filters.confidence));

  if (params.filters.sort !== "outcome") {
    events = sortEvents(events, params.filters.sort, {
      pinnedBooks: params.filters.pinnedBooks,
      pinnedActionableEdgeThreshold: Math.max(0.5, params.filters.edgeThresholdPct)
    });
  }

  let rows = events.map((event) =>
    buildBoardRow(event, params.board, params.league, params.model, params.filters.pinnedBooks, outcomeMap)
  );

  if (params.filters.outcomeStatus !== "all") {
    rows = rows.filter((row) =>
      params.filters.outcomeStatus === "pending" ? row.outcomeResult === null : row.outcomeResult === params.filters.outcomeStatus
    );
  }

  if (params.filters.edgeThresholdPct > 0) {
    rows = rows.filter((row) => Number.isFinite(row.evValue) && Number(row.evValue) >= params.filters.edgeThresholdPct);
  }

  if (params.filters.sort === "outcome") {
    const rank = new Map<string, number>([
      ["Pending", 0],
      ["Unknown", 1],
      ["Win", 2],
      ["Loss", 3],
      ["Push", 4],
      ["Void", 5]
    ]);
    rows = rows.sort((a, b) => (rank.get(a.outcomeLabel) ?? 99) - (rank.get(b.outcomeLabel) ?? 99) || (b.evValue ?? -999) - (a.evValue ?? -999));
  }

  return {
    title: "Board",
    subtitle: "Testing build. Public read-only preview of fair-line, freshness, and book coverage.",
    updatedLabel: formatUpdatedLabel(latestOddsUpdate(params.board.events, params.board.updatedAt)),
    resultLabel: `${rows.length} ${rows.length === 1 ? "market" : "markets"}`,
    coverageLabel: `${params.board.books.length} ${params.board.books.length === 1 ? "book" : "books"}`,
    staleExcludedCount: params.filters.includeStale ? 0 : staleEventsBeforeFilters.length,
    statusItems: [
      { label: "Feed", value: rows.length ? "Live feed" : "Thin feed", tone: rows.length ? "positive" : "warning" },
      { label: "Events", value: `${uniqueEventCount(events)}` },
      { label: "Markets", value: `${rows.length}` },
      { label: "Books", value: `${params.board.books.length}` },
      { label: "Odds refresh", value: formatUpdatedLabel(latestOddsUpdate(params.board.events, params.board.updatedAt)) },
      { label: "Cache", value: "Short cache" },
      { label: "Page render", value: formatUpdatedLabel(params.board.updatedAt) },
      { label: "Mode", value: "Read-only" },
      {
        label: "Stale excluded",
        value: `${params.filters.includeStale ? 0 : staleEventsBeforeFilters.length}`,
        tone: staleEventsBeforeFilters.length ? "warning" : "neutral"
      }
    ],
    rows,
    books: params.board.books,
    emptyTitle: "No qualifying markets for current filters.",
    emptyMessage: "Adjust filters or include stale markets."
  };
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
