import Link from "next/link";
import { redirect } from "next/navigation";
import { AppContainer } from "@/components/layout/AppContainer";
import { AppHeader } from "@/components/layout/AppHeader";
import { TeamAvatar } from "@/components/board/TeamAvatar";
import { EventTimelinePanel } from "@/components/board/EventTimelinePanel";
import { hasOddsKey, resolveRequestedMarket, toSportKey } from "@/lib/server/odds/pageData";
import { buildFairEventsForNormalizedEvent, getMarketAvailabilityForBoard, LIMITED_MARKET_MIN_BOOKS } from "@/lib/server/odds/fairEngine";
import { getNormalizedOdds } from "@/lib/server/odds/oddsService";
import { matchesEventRouteId, toEventRouteId } from "@/lib/server/odds/eventRoute";
import { readMarketTimeline } from "@/lib/server/odds/historyStore";
import { buildOutcomeMarketKey, persistBoardSnapshots } from "@/lib/server/odds/snapshotPersistence";
import { buildMarketTimeline } from "@/lib/server/odds/timeline";
import { deriveMarketPressureSignal, deriveValueTimingSignal } from "@/lib/server/odds/movement";
import {
  buildPickSummary,
  eventDetailHref,
  formatAmerican,
  formatMarketLabel,
  formatOffer,
  formatPoint,
  formatProbabilityGap,
  type BoardMode,
  type BoardSideKey,
  type BoardSortKey,
  type BoardNavigationContext
} from "@/components/board/board-helpers";
import type { FairEvent, FairOutcomeBook } from "@/lib/server/odds/types";
import type { MarketKey } from "@/lib/odds/schemas";
import styles from "./page.module.css";

function formatMatchTime(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "Start time unavailable";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(ts));
}

function joinTitles(values: string[]): string {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function sortBooks(books: FairOutcomeBook[]): FairOutcomeBook[] {
  return books
    .slice()
    .sort((a, b) => Number(b.isBestPrice) - Number(a.isBestPrice) || Math.abs(b.edgePct) - Math.abs(a.edgePct));
}

function formatImpliedPercent(prob: number): string {
  if (!Number.isFinite(prob)) return "--";
  return `${(prob * 100).toFixed(1)}%`;
}

function formatTableLine(market: MarketKey, point?: number): string {
  if (market === "h2h") return "ML";
  return Number.isFinite(point) ? formatPoint(point) : "--";
}

function formatDurationLabel(seconds: number | null | undefined): string {
  if (!Number.isFinite(seconds) || Number(seconds) <= 0) return "--";
  const totalSeconds = Math.round(Number(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.max(1, Math.round((totalSeconds % 3600) / 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatSignedPercent(value: number | null | undefined): string {
  if (!Number.isFinite(value)) return "--";
  const numeric = Number(value);
  return `${numeric > 0 ? "+" : ""}${numeric.toFixed(2)}%`;
}

function formatTierLabel(tier: FairOutcomeBook["tier"]): string {
  if (tier === "sharp") return "Sharp reference";
  if (tier === "signal") return "Signal book";
  if (tier === "exchange") return "Exchange";
  if (tier === "mainstream") return "Retail book";
  if (tier === "promo") return "Promo book";
  return "Market input";
}

function formatBookRole(book: FairOutcomeBook): string {
  if (book.isBestPrice) return "Best available";
  if (book.isSharpBook || book.tier === "sharp") return "Sharp input";
  return "Contributing";
}

type NormalizedEvent = Awaited<ReturnType<typeof getNormalizedOdds>>["normalized"][number];
type EventCandidate = {
  source: NormalizedEvent;
  event: FairEvent;
};

function decodeRouteId(routeId: string): string {
  try {
    return decodeURIComponent(routeId);
  } catch {
    return routeId;
  }
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

function resolveEventCandidate(params: {
  candidates: EventCandidate[];
  routeId: string;
}): EventCandidate | null {
  const decodedRouteId = decodeRouteId(params.routeId);
  const exactLegacyMatch =
    params.candidates.find((candidate) => candidate.event.id === decodedRouteId) ??
    params.candidates.find((candidate) => candidate.event.baseEventId === decodedRouteId);
  if (exactLegacyMatch) return exactLegacyMatch;

  return params.candidates.find((candidate) => matchesEventRouteId(candidate.event, params.routeId)) ?? null;
}

function routeTokens(routeId: string): Set<string> {
  return new Set(
    routeId
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2)
  );
}

function nearestCandidateRouteIds(params: {
  candidates: EventCandidate[];
  requestedRouteId: string;
  limit?: number;
}): string[] {
  const requestedTokens = routeTokens(params.requestedRouteId);
  const uniqueRouteIds = Array.from(new Set(params.candidates.map((candidate) => toEventRouteId(candidate.event))));

  return uniqueRouteIds
    .map((routeId) => {
      const candidateTokens = routeTokens(routeId);
      const overlap = Array.from(requestedTokens).reduce((total, token) => total + Number(candidateTokens.has(token)), 0);
      return { routeId, overlap };
    })
    .sort((a, b) => b.overlap - a.overlap || a.routeId.localeCompare(b.routeId))
    .slice(0, params.limit ?? 5)
    .map((entry) => entry.routeId);
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

function boardContextSearch(value?: string): string {
  return (value || "").trim();
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

export default async function GamePage({
  params,
  searchParams
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{
    league?: string;
    market?: string;
    model?: string;
    mode?: string;
    sort?: string;
    side?: string;
    search?: string;
    edge?: string;
  }>;
}) {
  const { eventId } = await params;
  const query = (await searchParams) || {};

  if (!hasOddsKey()) {
    return (
      <main className="config-shell">
        <section className="config-card">
          <h1>Configuration Required</h1>
          <p>ODDS_API_KEY is missing. Configure it to view game details.</p>
        </section>
      </main>
    );
  }

  const league = query.league || "nba";
  const market = query.market === "spreads" || query.market === "totals" ? query.market : "h2h";
  const model = query.model === "sharp" || query.model === "equal" || query.model === "weighted" ? query.model : "weighted";
  const boardContext: BoardNavigationContext = {
    mode: parseBoardMode(query.mode),
    windowKey: "all",
    sortBy: parseBoardSort(query.sort),
    side: parseBoardSide(query.side),
    search: boardContextSearch(query.search),
    positiveEdgeOnly: query.edge === "1" || query.edge === "true"
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
    redirect(`/games/${encodeURIComponent(eventId)}?${nextParams.toString()}`);
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
    routeId: eventId
  });
  const event = resolvedCandidate?.event ?? null;

  if (!event) {
    const nearestCandidates = nearestCandidateRouteIds({
      candidates: eventCandidates,
      requestedRouteId: eventId,
      limit: 5
    });

    return (
      <main className="grid-shell">
        <p>Event not found in the live board.</p>
        {process.env.NODE_ENV !== "production" ? (
          <section>
            <p>
              Requested route id: <code>{eventId}</code>
            </p>
            <p>Loaded events: {eventCandidates.length}</p>
            {nearestCandidates.length ? (
              <p>
                Nearest route ids: <code>{nearestCandidates.join(", ")}</code>
              </p>
            ) : null}
          </section>
        ) : null}
        <Link
          href={boardReturnHref({
            league,
            market: resolvedMarket,
            model,
            context: boardContext
          })}
        >
          Back to board
        </Link>
      </main>
    );
  }

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
            requestedRouteId: eventId
          });
          if (!relatedEvent && availability.status === "active") return null;
          return {
            market: availability.market,
            href: relatedEvent
              ? eventDetailHref({
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
    : [
        {
          market: event.market,
          href: eventDetailHref({
            event,
            league,
            market: event.market,
            model,
            context: boardContext
          }),
          status: "active" as const,
          pointGroups: 1
        }
      ];

  const currentMarketSwitch = marketSwitchOptions.find((entry) => entry.market === event.market) ?? null;
  const currentMarketStatus = marketAvailability.find((entry) => entry.market === event.market)?.status ?? "active";
  const showRepresentativeNote = event.market !== "h2h" && (currentMarketSwitch?.pointGroups ?? 0) > 1;

  const pickSummary = buildPickSummary(event);
  const featuredOutcome = pickSummary.outcome;
  const featuredBook = pickSummary.book;
  const featuredBooks = sortBooks(featuredOutcome.books);
  const probabilityGapLabel = featuredBook ? formatProbabilityGap(pickSummary.probabilityGapPct) : "--";
  const bestAvailableCopy = featuredBook
    ? `${formatAmerican(featuredBook.priceAmerican)} at ${featuredBook.title}`
    : "No live offer available";
  const fairLineCopy = `${formatOffer(event.market, featuredOutcome)} (model)`;
  const focusCopy = featuredBook
    ? `Best available is ${formatAmerican(featuredBook.priceAmerican)} at ${featuredBook.title} versus model fair ${formatOffer(event.market, featuredOutcome)}.`
    : `Model fair line is ${formatOffer(event.market, featuredOutcome)}.`;

  const sharpBooksUsed = Array.from(
    new Set(
      event.outcomes.flatMap((outcome) =>
        outcome.books.filter((book) => book.isSharpBook || book.tier === "sharp").map((book) => book.title)
      )
    )
  );
  const methodologyCopy = sharpBooksUsed.length
    ? `Sharp-book weighting currently includes ${joinTitles(sharpBooksUsed.slice(0, 3))}.`
    : "Sharp-book weighting is applied when sharp prices are available.";
  const historyEventId = event.baseEventId || event.id;
  const historyMarketKey = buildOutcomeMarketKey(event.market, featuredOutcome.name);
  const historyCapturedAt = Number.isFinite(Date.parse(normalizedResult.fetchedAt))
    ? Date.parse(normalizedResult.fetchedAt)
    : 0;
  await persistBoardSnapshots({
    sportKey,
    events: [event],
    capturedAt: historyCapturedAt
  });
  const rawTimeline = await readMarketTimeline(sportKey, historyEventId, historyMarketKey);
  const timeline = await buildMarketTimeline({
    sportKey,
    eventId: historyEventId,
    marketKey: historyMarketKey
  });
  const marketPressure = deriveMarketPressureSignal({
    timeline: rawTimeline,
    nowMs: historyCapturedAt
  });
  const valueTiming = deriveValueTimingSignal({
    timeline: rawTimeline,
    nowMs: historyCapturedAt
  });
  const pressureSignals = marketPressure.label === "none" ? [] : [marketPressure];
  const openPoint = timeline.points[0];
  const currentPoint = timeline.points[timeline.points.length - 1];
  const latestHistoryTs = currentPoint ? new Date(currentPoint.ts).toLocaleString() : "--";

  const backToBoardHref = boardReturnHref({
    league,
    market: event.market,
    model,
    context: boardContext
  });

  return (
    <AppContainer>
      <div className={styles.page}>
        <AppHeader
          eyebrow="EmpirePicks"
          title="Game Detail"
          subtitle="Model consensus fair line and market deviation context."
          breadcrumbs={[
            { label: boardContext.mode === "games" ? "Games" : "Board", href: backToBoardHref },
            { label: `${event.awayTeam} @ ${event.homeTeam}` }
          ]}
        />

        <div className={styles.workspace}>
          <section className={styles.summarySection}>
            <div className={styles.teamStack}>
              <TeamAvatar name={event.awayTeam} logoUrl={event.awayLogoUrl} size="md" showName={false} />
              <TeamAvatar name={event.homeTeam} logoUrl={event.homeLogoUrl} size="md" showName={false} />
              <h1 className={styles.matchupTitle}>
                {event.awayTeam} @ {event.homeTeam}
              </h1>
            </div>
            <p className={styles.metaLine}>{formatMatchTime(event.commenceTime)}</p>

            <div className={styles.marketTabs} aria-label="Markets">
              {marketSwitchOptions.map((entry) =>
                entry.status === "limited" && entry.market !== event.market ? (
                  <span key={`${entry.market}-limited`} className={styles.marketTabMuted} title="Limited live availability">
                    {formatMarketLabel(entry.market)}
                  </span>
                ) : (
                  <Link
                    key={`${entry.market}-${entry.href ?? "current"}`}
                    href={entry.href || "#"}
                    className={entry.market === event.market ? styles.marketTabActive : styles.marketTab}
                  >
                    {formatMarketLabel(entry.market)}
                  </Link>
                )
              )}
            </div>

            {currentMarketStatus === "limited" ? (
              <p className={styles.marketHint}>This market is live, but comparable line availability is limited right now.</p>
            ) : null}
            {showRepresentativeNote ? (
              <p className={styles.marketHint}>Default market view reflects the most widely available comparable line for this matchup.</p>
            ) : null}

            <div className={styles.pickSummary}>
              <div className={styles.pickHeader}>
                <div>
                  <p className={styles.pickLabel}>Market Focus</p>
                  <strong className={styles.pickName}>{featuredOutcome.name}</strong>
                </div>
                <span className={styles.pickStatus}>{formatMarketLabel(event.market)}</span>
              </div>
              <div className={styles.pickLine}>{formatOffer(event.market, featuredOutcome)}</div>
              <p className={styles.valueFraming}>{focusCopy}</p>

              <div className={styles.pickMetrics}>
                <div className={styles.pickMetric}>
                  <span>Best Available</span>
                  <strong>{bestAvailableCopy}</strong>
                </div>
                <div className={styles.pickMetric}>
                  <span>Fair Probability</span>
                  <strong>{`${(featuredOutcome.fairProb * 100).toFixed(2)}%`}</strong>
                </div>
                <div className={styles.pickMetric}>
                  <span>Probability Gap</span>
                  <strong>{probabilityGapLabel}</strong>
                </div>
                <div className={styles.pickMetric}>
                  <span>EV at Best Price</span>
                  <strong>{featuredBook ? formatSignedPercent(featuredBook.evPct) : "--"}</strong>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.tableSection}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Book Table</p>
                <h2 className={styles.sectionTitle}>{featuredOutcome.name} pricing across books</h2>
              </div>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.bookTable}>
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>Role</th>
                    <th>Line</th>
                    <th>Odds</th>
                    <th>No-Vig %</th>
                    <th>Prob Gap</th>
                    <th>EV</th>
                  </tr>
                </thead>
                <tbody>
                  {featuredBooks.map((book) => {
                    const isSharp = book.isSharpBook || book.tier === "sharp";
                    return (
                      <tr
                        key={`${featuredOutcome.name}-${book.bookKey}`}
                        className={`${book.isBestPrice ? styles.bestBookRow : ""} ${isSharp ? styles.sharpBookRow : ""}`.trim()}
                      >
                        <td>
                          <div className={styles.bookCell}>
                            <strong>{book.title}</strong>
                            <span className={styles.bookMeta}>{formatTierLabel(book.tier)}</span>
                          </div>
                        </td>
                        <td>{formatBookRole(book)}</td>
                        <td>{formatTableLine(event.market, book.point)}</td>
                        <td className={styles.numeric}>{formatAmerican(book.priceAmerican)}</td>
                        <td className={styles.numeric}>{formatImpliedPercent(book.impliedProbNoVig)}</td>
                        <td className={styles.numeric}>{formatProbabilityGap(book.edgePct)}</td>
                        <td className={styles.numeric}>{formatSignedPercent(book.evPct)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.modelSection}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>History</p>
                <h2 className={styles.sectionTitle}>Observed line history</h2>
              </div>
            </div>

            <div className={styles.contextGrid}>
              <div className={styles.contextMetric}>
                <span>Opening vs Current</span>
                <strong>
                  {openPoint
                    ? `${formatAmerican(openPoint.globalBestAmerican ?? 0)} to ${formatAmerican(currentPoint?.globalBestAmerican ?? 0)}`
                    : "--"}
                </strong>
              </div>
              <div className={styles.contextMetric}>
                <span>Sharp/Public Signal</span>
                <strong>{pressureSignals[0]?.label ?? "none"}</strong>
              </div>
              <div className={styles.contextMetric}>
                <span>Value Persistence</span>
                <strong>
                  {valueTiming.valuePersistence === "stable" && valueTiming.positiveEvDurationSeconds
                    ? `Stable for ${formatDurationLabel(valueTiming.positiveEvDurationSeconds)}`
                    : valueTiming.valuePersistence}
                </strong>
              </div>
              <div className={styles.contextMetric}>
                <span>Last Updated</span>
                <strong>{latestHistoryTs}</strong>
              </div>
            </div>

            <p className={styles.contextNote}>{pressureSignals[0]?.explanation ?? "Observed history is still sparse for this market."}</p>
            <p className={styles.contextNote}>
              Probability-gap trend {valueTiming.edgeTrend}. Positive EV observed for {formatDurationLabel(valueTiming.positiveEvDurationSeconds)}.
            </p>

            <EventTimelinePanel outcome={featuredOutcome.name} timeline={timeline} pressureSignals={pressureSignals} />
          </section>

          <section className={styles.modelSection}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Model Context</p>
                <h2 className={styles.sectionTitle}>How value is derived</h2>
              </div>
            </div>

            <div className={styles.contextGrid}>
              <div className={styles.contextMetric}>
                <span>Best Available</span>
                <strong>{bestAvailableCopy}</strong>
              </div>
              <div className={styles.contextMetric}>
                <span>Fair Line</span>
                <strong>{fairLineCopy}</strong>
              </div>
              <div className={styles.contextMetric}>
                <span>Fair Probability</span>
                <strong>{`${(featuredOutcome.fairProb * 100).toFixed(2)}%`}</strong>
              </div>
              <div className={styles.contextMetric}>
                <span>Break-Even Rate</span>
                <strong>{featuredBook ? formatImpliedPercent(featuredBook.impliedProbNoVig) : "--"}</strong>
              </div>
              <div className={styles.contextMetric}>
                <span>Probability Gap</span>
                <strong>{probabilityGapLabel}</strong>
              </div>
              <div className={styles.contextMetric}>
                <span>EV at Best Available</span>
                <strong>{featuredBook ? formatSignedPercent(featuredBook.evPct) : "--"}</strong>
              </div>
            </div>

            <p className={styles.contextNote}>Vig is removed from each market before computing consensus fair probability and fair value.</p>
            <p className={styles.contextNote}>{methodologyCopy}</p>
            <p className={styles.contextNote}>Probability Gap reflects model fair probability versus the break-even rate of the offered price.</p>

            <div className={styles.backRow}>
              <Link href={backToBoardHref} className="app-link">
                Back to Board
              </Link>
            </div>
          </section>
        </div>
      </div>
    </AppContainer>
  );
}
