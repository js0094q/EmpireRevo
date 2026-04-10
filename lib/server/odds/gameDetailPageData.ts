import { redirect } from "next/navigation";
import { resolveRequestedMarket, toSportKey } from "@/lib/server/odds/pageData";
import { buildFairEventsForNormalizedEvent, getMarketAvailabilityForBoard, LIMITED_MARKET_MIN_BOOKS } from "@/lib/server/odds/fairEngine";
import { getNormalizedOdds } from "@/lib/server/odds/oddsService";
import { matchesEventRouteId, toEventRouteId } from "@/lib/server/odds/eventRoute";
import { readMarketTimeline } from "@/lib/server/odds/historyStore";
import { buildMarketTimeline } from "@/lib/server/odds/timeline";
import { deriveMarketPressureSignal, deriveValueTimingSignal } from "@/lib/server/odds/movement";
import type { MarketKey } from "@/lib/odds/schemas";
import type { FairEvent, FairOutcome, FairOutcomeBook, MarketPressureSignal, MarketTimelineResponse, ValueTimingSignal } from "@/lib/server/odds/types";
import { buildPickSummary, type BoardMode, type BoardNavigationContext, type BoardSideKey, type BoardSortKey } from "@/components/board/board-helpers";
import { buildOutcomeMarketKey } from "@/lib/server/odds/snapshotPersistence";

type NormalizedEvent = Awaited<ReturnType<typeof getNormalizedOdds>>["normalized"][number];

type EventCandidate = {
  source: NormalizedEvent;
  event: FairEvent;
};

export type GameDetailPageData = {
  league: string;
  model: "sharp" | "equal" | "weighted";
  event: FairEvent;
  featuredOutcome: FairOutcome;
  featuredBook: FairOutcomeBook | null;
  featuredBooks: FairOutcomeBook[];
  marketSwitchOptions: Array<{ market: MarketKey; href: string | null; status: "active" | "limited"; pointGroups: number }>;
  currentMarketStatus: "active" | "limited" | "unavailable";
  showRepresentativeNote: boolean;
  focusCopy: string;
  methodologyCopy: string;
  probabilityGapPct: number;
  timeline: MarketTimelineResponse | null;
  pressureSignals: MarketPressureSignal[];
  valueTiming: ValueTimingSignal;
  latestHistoryTs: string;
  backToBoardHref: string;
  boardContext: BoardNavigationContext;
  routeId: string;
  internalContext: {
    historyEventId: string;
    historyMarketKey: string;
    timelinePoints: number;
    pressureLabel: string;
    valuePersistence: string;
  };
};

function decodeRouteId(routeId: string): string {
  try {
    return decodeURIComponent(routeId);
  } catch {
    return routeId;
  }
}

function sortBooks(books: FairOutcomeBook[]): FairOutcomeBook[] {
  return books
    .slice()
    .sort((a, b) => Number(b.isBestPrice) - Number(a.isBestPrice) || Math.abs(b.edgePct) - Math.abs(a.edgePct));
}

function collectEventCandidates(params: {
  normalized: NormalizedEvent[];
  sportKey: string;
  market: MarketKey;
  model: "sharp" | "equal" | "weighted";
  minBooks: number;
}): EventCandidate[] {
  return params.normalized.flatMap((source) =>
    buildFairEventsForNormalizedEvent({
      normalized: source,
      sportKey: params.sportKey,
      market: params.market,
      model: params.model,
      minBooks: params.minBooks
    }).map((event) => ({ source, event }))
  );
}

function resolveEventCandidate(params: { candidates: EventCandidate[]; routeId: string }): EventCandidate | null {
  const decodedRouteId = decodeRouteId(params.routeId);
  const exactLegacyMatch =
    params.candidates.find((candidate) => candidate.event.id === decodedRouteId) ??
    params.candidates.find((candidate) => candidate.event.baseEventId === decodedRouteId);
  if (exactLegacyMatch) return exactLegacyMatch;

  return params.candidates.find((candidate) => matchesEventRouteId(candidate.event, params.routeId)) ?? null;
}

function pickRelatedMarketEvent(params: {
  relatedEvents: FairEvent[];
  currentEvent: FairEvent;
  requestedRouteId: string;
}): FairEvent | null {
  if (!params.relatedEvents.length) return null;
  const currentPoint = Number(params.currentEvent.linePoint);

  const exactLineMatch = params.relatedEvents.find((candidate) => candidate.id === params.currentEvent.id);
  if (exactLineMatch) return exactLineMatch;

  const routeMatch = params.relatedEvents.find((candidate) => matchesEventRouteId(candidate, params.requestedRouteId));
  if (routeMatch) return routeMatch;

  if (Number.isFinite(currentPoint)) {
    const closestByPoint = params.relatedEvents
      .slice()
      .sort((a, b) => Math.abs(Number(a.linePoint ?? currentPoint) - currentPoint) - Math.abs(Number(b.linePoint ?? currentPoint) - currentPoint))[0];
    if (closestByPoint) return closestByPoint;
  }

  return params.relatedEvents[0] ?? null;
}

function parseBoardMode(value?: string): BoardMode {
  return value === "games" ? "games" : "board";
}

function parseBoardSort(value?: string): BoardSortKey {
  if (value === "edge" || value === "confidence" || value === "best" || value === "soonest" || value === "timing") return value;
  return "score";
}

function parseBoardSide(value?: string): BoardSideKey {
  if (value === "favored" || value === "underdogs") return value;
  return "all";
}

function boardReturnHref(params: {
  league: string;
  market: MarketKey;
  model: "sharp" | "equal" | "weighted";
  context: BoardNavigationContext;
}): string {
  const basePath = params.context.mode === "games" ? "/games" : "/";
  const query = new URLSearchParams({
    league: params.league,
    market: params.market,
    model: params.model
  });
  if (params.context.sortBy && params.context.sortBy !== "score") query.set("sort", params.context.sortBy);
  if (params.context.side && params.context.side !== "all") query.set("side", params.context.side);
  const search = params.context.search?.trim();
  if (search) query.set("search", search);
  if (params.context.positiveEdgeOnly) query.set("edge", "1");
  return `${basePath}?${query.toString()}`;
}

function detailHref(params: {
  event: FairEvent;
  league: string;
  market: FairEvent["market"];
  model: "sharp" | "equal" | "weighted";
  context: BoardNavigationContext;
}): string {
  const query = new URLSearchParams({
    league: params.league,
    market: params.market,
    model: params.model
  });
  if (params.context.mode === "games") query.set("mode", "games");
  if (params.context.sortBy && params.context.sortBy !== "score") query.set("sort", params.context.sortBy);
  if (params.context.side && params.context.side !== "all") query.set("side", params.context.side);
  const search = params.context.search?.trim();
  if (search) query.set("search", search);
  if (params.context.positiveEdgeOnly) query.set("edge", "1");
  return `/game/${encodeURIComponent(toEventRouteId(params.event))}?${query.toString()}`;
}

function joinTitles(values: string[]): string {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

export async function getGameDetailPageData(params: {
  eventId: string;
  query: {
    league?: string;
    market?: string;
    model?: string;
    mode?: string;
    sort?: string;
    side?: string;
    search?: string;
    edge?: string;
  };
}): Promise<GameDetailPageData | null> {
  const league = params.query.league || "nba";
  const market = params.query.market === "spreads" || params.query.market === "totals" ? params.query.market : "h2h";
  const model = params.query.model === "sharp" || params.query.model === "equal" || params.query.model === "weighted" ? params.query.model : "weighted";
  const boardContext: BoardNavigationContext = {
    mode: parseBoardMode(params.query.mode),
    windowKey: "all",
    sortBy: parseBoardSort(params.query.sort),
    side: parseBoardSide(params.query.side),
    search: (params.query.search || "").trim(),
    positiveEdgeOnly: params.query.edge === "1" || params.query.edge === "true"
  };
  const minBooks = 4;

  const sportKey = toSportKey(league);
  const normalizedResult = await getNormalizedOdds({
    sportKey,
    regions: "us",
    markets: "h2h,spreads,totals",
    oddsFormat: "american"
  });

  const marketAvailability = getMarketAvailabilityForBoard({
    normalized: normalizedResult.normalized,
    model,
    minBooks
  });
  const { resolvedMarket, resolvedStatus } = resolveRequestedMarket({
    requestedMarket: market,
    marketAvailability
  });
  if (resolvedMarket !== market) {
    const nextParams = new URLSearchParams({
      league,
      market: resolvedMarket,
      model
    });
    if (boardContext.mode === "games") nextParams.set("mode", "games");
    if (boardContext.sortBy && boardContext.sortBy !== "score") nextParams.set("sort", boardContext.sortBy);
    if (boardContext.side && boardContext.side !== "all") nextParams.set("side", boardContext.side);
    if (boardContext.search?.trim()) nextParams.set("search", boardContext.search.trim());
    if (boardContext.positiveEdgeOnly) nextParams.set("edge", "1");
    redirect(`/game/${encodeURIComponent(params.eventId)}?${nextParams.toString()}`);
  }

  const effectiveMinBooks = resolvedStatus === "limited" ? LIMITED_MARKET_MIN_BOOKS : minBooks;
  const eventCandidates = collectEventCandidates({
    normalized: normalizedResult.normalized,
    sportKey,
    market: resolvedMarket,
    model,
    minBooks: effectiveMinBooks
  });
  const resolvedCandidate = resolveEventCandidate({
    candidates: eventCandidates,
    routeId: params.eventId
  });
  const event = resolvedCandidate?.event ?? null;
  if (!event) return null;

  const sourceEvent = resolvedCandidate?.source ?? null;
  const marketSwitchOptions = sourceEvent
    ? marketAvailability
        .filter((entry) => entry.status !== "unavailable")
        .map((availability) => {
          const selectionMinBooks = availability.status === "limited" ? LIMITED_MARKET_MIN_BOOKS : minBooks;
          const relatedEvents = buildFairEventsForNormalizedEvent({
            normalized: sourceEvent,
            sportKey,
            market: availability.market,
            model,
            minBooks: selectionMinBooks
          });
          const relatedEvent = pickRelatedMarketEvent({
            relatedEvents,
            currentEvent: event,
            requestedRouteId: params.eventId
          });
          if (!relatedEvent && availability.status === "active") return null;
          return {
            market: availability.market,
            href: relatedEvent
              ? detailHref({
                  event: relatedEvent,
                  league,
                  market: relatedEvent.market,
                  model,
                  context: boardContext
                })
              : null,
            status: availability.status,
            pointGroups: relatedEvents.length
          };
        })
        .filter((entry): entry is { market: MarketKey; href: string | null; status: "active" | "limited"; pointGroups: number } => Boolean(entry))
    : [];

  const currentMarketSwitch = marketSwitchOptions.find((entry) => entry.market === event.market) ?? null;
  const currentMarketStatus = marketAvailability.find((entry) => entry.market === event.market)?.status ?? "active";
  const showRepresentativeNote = event.market !== "h2h" && (currentMarketSwitch?.pointGroups ?? 0) > 1;

  const pickSummary = buildPickSummary(event);
  const featuredOutcome = pickSummary.outcome;
  const featuredBook = pickSummary.book;
  const featuredBooks = sortBooks(featuredOutcome.books);
  const focusCopy = featuredBook
    ? `${featuredBook.title} is posting ${featuredBook.priceAmerican > 0 ? "+" : ""}${featuredBook.priceAmerican} against model fair ${featuredOutcome.fairAmerican > 0 ? "+" : ""}${featuredOutcome.fairAmerican}.`
    : `Model fair is ${featuredOutcome.fairAmerican > 0 ? "+" : ""}${featuredOutcome.fairAmerican}.`;

  const sharpBooksUsed = Array.from(
    new Set(
      event.outcomes.flatMap((outcome) =>
        outcome.books.filter((book) => book.isSharpBook || book.tier === "sharp").map((book) => book.title)
      )
    )
  );
  const methodologyCopy = sharpBooksUsed.length
    ? `Sharp weighting includes ${joinTitles(sharpBooksUsed.slice(0, 3))}.`
    : "Sharp weighting is applied when sharp prices are available.";

  const historyEventId = event.baseEventId || event.id;
  const historyMarketKey = buildOutcomeMarketKey(event.market, featuredOutcome.name);
  const rawTimeline = await readMarketTimeline(sportKey, historyEventId, historyMarketKey);
  const timeline = await buildMarketTimeline({
    sportKey,
    eventId: historyEventId,
    marketKey: historyMarketKey
  });
  const marketPressure = deriveMarketPressureSignal({
    timeline: rawTimeline,
    nowMs: Date.now()
  });
  const valueTiming = deriveValueTimingSignal({
    timeline: rawTimeline,
    nowMs: Date.now()
  });
  const pressureSignals = marketPressure.label === "none" ? [] : [marketPressure];
  const latestHistoryTs =
    timeline && timeline.points.length
      ? new Date(timeline.points[timeline.points.length - 1]!.ts).toLocaleString()
      : "—";

  return {
    league,
    model,
    event,
    featuredOutcome,
    featuredBook,
    featuredBooks,
    marketSwitchOptions,
    currentMarketStatus,
    showRepresentativeNote,
    focusCopy,
    methodologyCopy,
    probabilityGapPct: pickSummary.probabilityGapPct,
    timeline,
    pressureSignals,
    valueTiming,
    latestHistoryTs,
    backToBoardHref: boardReturnHref({
      league,
      market: event.market,
      model,
      context: boardContext
    }),
    boardContext,
    routeId: params.eventId,
    internalContext: {
      historyEventId,
      historyMarketKey,
      timelinePoints: timeline?.points.length ?? 0,
      pressureLabel: marketPressure.label,
      valuePersistence: valueTiming.valuePersistence
    }
  };
}
