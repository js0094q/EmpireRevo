import type { FairEvent } from "@/lib/server/odds/types";
import type { BoardSortKey } from "@/components/board/board-helpers";

export type StartWindowKey = "all" | "6h" | "12h" | "24h";
export type SideFilter = "all" | "favorites" | "underdogs";
export type SortKey = BoardSortKey | "stale" | "sharp_dev" | "market" | "pinned_edge" | "pinned_score" | "pinned_stale";

export type EventFilterOptions = {
  teamQuery: string;
  visibleBookKeys: Set<string>;
  edgeThresholdPct: number;
  minContributingBooks: number;
  minConfidenceScore: number;
  minSharpParticipation: number;
  startWindow: StartWindowKey;
  positiveEvOnly: boolean;
  sideFilter: SideFilter;
  bestEdgesOnly: boolean;
  staleOnly: boolean;
  highCoverageOnly: boolean;
  trustedBooksOnly: boolean;
  pinnedOnly: boolean;
  pinnedBooks: Set<string>;
  pinnedActionableEdgeThreshold?: number;
};

type PinnedMetrics = {
  bestEdge: number;
  bestStale: number;
  bestScore: number;
  hasActionable: boolean;
};

function eventHasVisibleBook(event: FairEvent, visibleBookKeys: Set<string>): boolean {
  return event.outcomes.some((outcome) => outcome.books.some((book) => visibleBookKeys.has(book.bookKey)));
}

function eventMaxVisibleEdge(event: FairEvent, visibleBookKeys: Set<string>): number {
  let maxAbs = 0;
  for (const outcome of event.outcomes) {
    for (const book of outcome.books) {
      if (!visibleBookKeys.has(book.bookKey)) continue;
      maxAbs = Math.max(maxAbs, Math.abs(book.edgePct));
    }
  }
  return maxAbs;
}

function eventHasPositiveEv(event: FairEvent, visibleBookKeys: Set<string>): boolean {
  return event.outcomes.some((outcome) =>
    outcome.books.some((book) => visibleBookKeys.has(book.bookKey) && book.evQualified && book.evPct > 0)
  );
}

function eventMatchesSideFilter(event: FairEvent, sideFilter: SideFilter): boolean {
  if (sideFilter === "all") return true;
  if (sideFilter === "favorites") {
    return event.outcomes.some((outcome) => outcome.consensusDirection === "favored");
  }
  return event.outcomes.some((outcome) => outcome.consensusDirection === "underdog");
}

function eventHasTrustedBook(event: FairEvent, visibleBookKeys: Set<string>): boolean {
  return event.outcomes.some((outcome) =>
    outcome.books.some(
      (book) =>
        visibleBookKeys.has(book.bookKey) &&
        (book.tier === "sharp" || book.tier === "signal" || book.tier === "mainstream")
    )
  );
}

function eventHasStaleOpportunity(event: FairEvent, visibleBookKeys: Set<string>): boolean {
  return event.outcomes.some((outcome) =>
    outcome.books.some(
      (book) =>
        visibleBookKeys.has(book.bookKey) &&
        Boolean(book.staleActionable) &&
        (book.staleFlag === "stale_price" || book.staleFlag === "lagging_book" || book.staleFlag === "best_market_confirmed")
    )
  );
}

function pinnedMetrics(event: FairEvent, pinnedBooks: Set<string>, edgeThreshold: number): PinnedMetrics {
  if (!pinnedBooks.size) {
    return {
      bestEdge: 0,
      bestStale: 0,
      bestScore: 0,
      hasActionable: false
    };
  }

  let bestEdge = Number.NEGATIVE_INFINITY;
  let bestStale = Number.NEGATIVE_INFINITY;
  let bestScore = Number.NEGATIVE_INFINITY;
  let hasActionable = false;

  for (const outcome of event.outcomes) {
    for (const book of outcome.books) {
      if (!pinnedBooks.has(book.bookKey)) continue;

      bestEdge = Math.max(bestEdge, book.edgePct);
      bestStale = Math.max(bestStale, book.staleStrength ?? 0);

      const score =
        100 *
        (0.48 * Math.max(0, Math.min(1, book.edgePct / 3)) +
          0.22 * outcome.confidenceScore +
          0.2 * (book.staleStrength ?? 0) +
          0.1 * outcome.timingSignal.urgencyScore);
      bestScore = Math.max(bestScore, score);

      const actionableByEdge = book.edgePct >= edgeThreshold;
      const actionableByState = Boolean(book.staleActionable) || outcome.timingSignal.label === "Likely closing";
      if (actionableByEdge && actionableByState) {
        hasActionable = true;
      }
    }
  }

  return {
    bestEdge: Number.isFinite(bestEdge) ? bestEdge : 0,
    bestStale: Number.isFinite(bestStale) ? bestStale : 0,
    bestScore: Number.isFinite(bestScore) ? bestScore : 0,
    hasActionable
  };
}

function eventHasPinnedActionableEdge(event: FairEvent, pinnedBooks: Set<string>, edgeThreshold: number): boolean {
  return pinnedMetrics(event, pinnedBooks, edgeThreshold).hasActionable;
}

function windowMs(windowKey: StartWindowKey): number {
  if (windowKey === "6h") return 6 * 60 * 60 * 1000;
  if (windowKey === "12h") return 12 * 60 * 60 * 1000;
  if (windowKey === "24h") return 24 * 60 * 60 * 1000;
  return Number.POSITIVE_INFINITY;
}

function tierRank(tier: "sharp" | "signal" | "mainstream" | "promo" | "unknown"): number {
  if (tier === "sharp") return 0;
  if (tier === "signal") return 1;
  if (tier === "mainstream") return 2;
  if (tier === "promo") return 3;
  return 4;
}

export function filterEvents(events: FairEvent[], options: EventFilterOptions): FairEvent[] {
  const query = options.teamQuery.trim().toLowerCase();
  const now = Date.now();
  const cutoffMs = windowMs(options.startWindow);
  const pinnedEdgeThreshold = options.pinnedActionableEdgeThreshold ?? 0.5;

  let filtered = events.filter((event) => eventHasVisibleBook(event, options.visibleBookKeys));

  if (query) {
    filtered = filtered.filter((event) => `${event.awayTeam} ${event.homeTeam}`.toLowerCase().includes(query));
  }

  if (options.startWindow !== "all") {
    filtered = filtered.filter((event) => {
      const kickoffTs = Date.parse(event.commenceTime);
      return Number.isFinite(kickoffTs) && kickoffTs - now <= cutoffMs;
    });
  }

  if (options.minContributingBooks > 1) {
    filtered = filtered.filter((event) => event.contributingBookCount >= options.minContributingBooks);
  }

  if (options.edgeThresholdPct > 0) {
    filtered = filtered.filter((event) => eventMaxVisibleEdge(event, options.visibleBookKeys) >= options.edgeThresholdPct);
  }

  if (options.minConfidenceScore > 0) {
    filtered = filtered.filter((event) => event.confidenceScore >= options.minConfidenceScore);
  }

  if (options.minSharpParticipation > 0) {
    filtered = filtered.filter((event) =>
      event.outcomes.some((outcome) => outcome.sharpParticipationPct >= options.minSharpParticipation)
    );
  }

  if (options.positiveEvOnly) {
    filtered = filtered.filter((event) => eventHasPositiveEv(event, options.visibleBookKeys));
  }

  if (options.staleOnly) {
    filtered = filtered.filter((event) => eventHasStaleOpportunity(event, options.visibleBookKeys));
  }

  if (options.highCoverageOnly) {
    filtered = filtered.filter((event) => event.totalBookCount > 0 && event.contributingBookCount / event.totalBookCount >= 0.75);
  }

  if (options.trustedBooksOnly) {
    filtered = filtered.filter((event) => eventHasTrustedBook(event, options.visibleBookKeys));
  }

  if (options.pinnedOnly) {
    filtered = filtered.filter((event) => eventHasPinnedActionableEdge(event, options.pinnedBooks, pinnedEdgeThreshold));
  }

  filtered = filtered.filter((event) => eventMatchesSideFilter(event, options.sideFilter));

  if (options.bestEdgesOnly && filtered.length > 6) {
    const ranked = [...filtered].sort(
      (a, b) => eventMaxVisibleEdge(b, options.visibleBookKeys) - eventMaxVisibleEdge(a, options.visibleBookKeys)
    );
    const cutoffIndex = Math.max(5, Math.floor(ranked.length * 0.35));
    const allowed = new Set(ranked.slice(0, cutoffIndex).map((event) => event.id));
    filtered = filtered.filter((event) => allowed.has(event.id));
  }

  return filtered;
}

export function sortEvents(
  events: FairEvent[],
  sortBy: SortKey,
  options?: { pinnedBooks?: Set<string>; pinnedActionableEdgeThreshold?: number }
): FairEvent[] {
  const pinned = options?.pinnedBooks ?? new Set<string>();
  const threshold = options?.pinnedActionableEdgeThreshold ?? 0.5;

  if (sortBy === "soonest") {
    return [...events].sort((a, b) => Date.parse(a.commenceTime) - Date.parse(b.commenceTime));
  }

  if (sortBy === "best") {
    return [...events].sort((a, b) => {
      const aBest = Math.max(...a.outcomes.map((outcome) => outcome.bestPrice));
      const bBest = Math.max(...b.outcomes.map((outcome) => outcome.bestPrice));
      return bBest - aBest;
    });
  }

  if (sortBy === "confidence") {
    return [...events].sort((a, b) => b.confidenceScore - a.confidenceScore || b.opportunityScore - a.opportunityScore);
  }

  if (sortBy === "stale") {
    return [...events].sort((a, b) => b.staleStrength - a.staleStrength || b.opportunityScore - a.opportunityScore);
  }

  if (sortBy === "sharp_dev") {
    return [...events].sort((a, b) => {
      const aDev = Math.max(...a.outcomes.map((outcome) => Math.abs(outcome.sharpDeviation)));
      const bDev = Math.max(...b.outcomes.map((outcome) => Math.abs(outcome.sharpDeviation)));
      return bDev - aDev;
    });
  }

  if (sortBy === "pinned_edge") {
    return [...events].sort((a, b) => pinnedMetrics(b, pinned, threshold).bestEdge - pinnedMetrics(a, pinned, threshold).bestEdge);
  }

  if (sortBy === "pinned_stale") {
    return [...events].sort(
      (a, b) => pinnedMetrics(b, pinned, threshold).bestStale - pinnedMetrics(a, pinned, threshold).bestStale
    );
  }

  if (sortBy === "pinned_score") {
    return [...events].sort(
      (a, b) => pinnedMetrics(b, pinned, threshold).bestScore - pinnedMetrics(a, pinned, threshold).bestScore
    );
  }

  if (sortBy === "timing") {
    return [...events].sort((a, b) => {
      const aUrgency = Math.max(...a.outcomes.map((outcome) => outcome.timingSignal.urgencyScore));
      const bUrgency = Math.max(...b.outcomes.map((outcome) => outcome.timingSignal.urgencyScore));
      return bUrgency - aUrgency;
    });
  }

  if (sortBy === "score") {
    return [...events].sort((a, b) => b.opportunityScore - a.opportunityScore);
  }

  if (sortBy === "edge") {
    return [...events].sort((a, b) => b.maxAbsEdgePct - a.maxAbsEdgePct);
  }

  return [...events];
}

export function orderBooksForGrid(
  books: Array<{ key: string; title: string; tier: "sharp" | "signal" | "mainstream" | "promo" | "unknown" }>,
  pinned: Set<string>
): Array<{ key: string; title: string; tier: "sharp" | "signal" | "mainstream" | "promo" | "unknown" }> {
  return [...books].sort((a, b) => {
    const aPinned = pinned.has(a.key);
    const bPinned = pinned.has(b.key);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;

    const tierDiff = tierRank(a.tier) - tierRank(b.tier);
    if (tierDiff !== 0) return tierDiff;

    return a.title.localeCompare(b.title);
  });
}

export function pinnedBestEdgeScore(event: FairEvent, pinnedBooks: Set<string>): number {
  return pinnedMetrics(event, pinnedBooks, 0.5).bestEdge;
}

export function pinnedEventMetrics(event: FairEvent, pinnedBooks: Set<string>, edgeThreshold = 0.5): PinnedMetrics {
  return pinnedMetrics(event, pinnedBooks, edgeThreshold);
}
