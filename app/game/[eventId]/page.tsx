import Link from "next/link";
import { redirect } from "next/navigation";
import { AppContainer } from "@/components/layout/AppContainer";
import { AppHeader } from "@/components/layout/AppHeader";
import { ConfidencePill } from "@/components/board/ConfidencePill";
import { EdgeBadge } from "@/components/board/EdgeBadge";
import { EventTimelinePanel } from "@/components/board/EventTimelinePanel";
import { MovementPill } from "@/components/board/MovementPill";
import { TeamAvatar } from "@/components/board/TeamAvatar";
import { getPersistenceStatus } from "@/lib/server/odds/persistence";
import { hasOddsKey, resolveRequestedMarket, toSportKey } from "@/lib/server/odds/pageData";
import { buildOutcomeMarketKey } from "@/lib/server/odds/snapshotPersistence";
import { buildMarketTimeline } from "@/lib/server/odds/timeline";
import { detectMarketPressureForMarket } from "@/lib/server/odds/marketPressure";
import { buildFairEventsForNormalizedEvent, getMarketAvailabilityForBoard, LIMITED_MARKET_MIN_BOOKS } from "@/lib/server/odds/fairEngine";
import { getNormalizedOdds } from "@/lib/server/odds/oddsService";
import { matchesEventRouteId, toEventRouteId } from "@/lib/server/odds/eventRoute";
import { buildPickSummary, eventDetailHref, formatMarketLabel, formatOffer, strongestBook } from "@/components/board/board-helpers";
import type { FairEvent, FairOutcomeBook } from "@/lib/server/odds/types";
import type { MarketKey } from "@/lib/odds/schemas";
import styles from "./page.module.css";

function formatRole(book: FairOutcomeBook): string {
  if (book.tier === "sharp") return `Sharp market maker · ${book.weight.toFixed(2)}x`;
  if (book.tier === "signal") return `Reference book · ${book.weight.toFixed(2)}x`;
  if (book.tier === "mainstream") return `Mainstream book · ${book.weight.toFixed(2)}x`;
  if (book.tier === "promo") return `Promo book · ${book.weight.toFixed(2)}x`;
  return `Book weight ${book.weight.toFixed(2)}x`;
}

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

export default async function GamePage({
  params,
  searchParams
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{ league?: string; market?: string; model?: string }>;
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
    redirect(`/game/${encodeURIComponent(eventId)}?${nextParams.toString()}`);
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
        <Link href={`/?league=${league}&market=${resolvedMarket}&model=${model}`}>Back to board</Link>
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
                  model
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
            model
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
  const sharpBooksUsed = Array.from(
    new Set(
      event.outcomes.flatMap((outcome) =>
        outcome.books.filter((book) => book.isSharpBook || book.tier === "sharp").map((book) => book.title)
      )
    )
  );
  const methodologyCopy = sharpBooksUsed.length
    ? `Consensus fair prices lean on sharper market-making books when available, including ${joinTitles(sharpBooksUsed.slice(0, 3))}.`
    : null;

  const persistence = getPersistenceStatus();
  const outcomeTimeline = persistence.durable
    ? await Promise.all(
        event.outcomes.map(async (outcome) => {
          const point = outcome.books[0]?.point ?? event.linePoint;
          const marketKey = buildOutcomeMarketKey(event.market, outcome.name, point);
          const [timeline, pressureSignals] = await Promise.all([
            buildMarketTimeline({
              sportKey: event.sportKey,
              eventId: event.id,
              marketKey,
              rollingPoints: 200
            }),
            detectMarketPressureForMarket({
              sportKey: event.sportKey,
              eventId: event.id,
              marketKey
            })
          ]);

          return {
            outcomeName: outcome.name,
            timeline,
            pressureSignals
          };
        })
      )
    : [];
  const timelineByOutcome = new Map(outcomeTimeline.map((entry) => [entry.outcomeName, entry]));

  return (
    <AppContainer>
      <div className={styles.page}>
        <AppHeader
          eyebrow="EmpirePicks"
          title="Event Detail"
          subtitle="Compare live sportsbook prices against the consensus fair line."
          breadcrumbs={[
            { label: "Board", href: `/?league=${league}&market=${event.market}&model=${model}` },
            { label: `${event.awayTeam} @ ${event.homeTeam}` }
          ]}
        />

        <div className={styles.contentGrid}>
          <section className={styles.summaryCard}>
            <div className={styles.teamStack}>
              <TeamAvatar name={event.awayTeam} logoUrl={event.awayLogoUrl} size="lg" showName={false} />
              <TeamAvatar name={event.homeTeam} logoUrl={event.homeLogoUrl} size="lg" showName={false} />
            </div>

            <div className={styles.metaBlock}>
              <h1 className={styles.matchupTitle}>
                {event.awayTeam} @ {event.homeTeam}
              </h1>
              <p className={styles.metaLine}>{formatMatchTime(event.commenceTime)}</p>
            </div>

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

            <div className={styles.decisionSummary}>
              <div className={styles.recommendationRow}>
                <span className={styles.eyebrow}>{pickSummary.label}</span>
                <span className={styles.pickStatus}>{pickSummary.status}</span>
              </div>
              <strong className={styles.pickName}>{featuredOutcome.name}</strong>

              <div className={styles.decisionRow}>
                <span className={styles.eyebrow}>Best Available Line</span>
                <span className={styles.decisionValue}>{featuredBook ? `${formatOffer(event.market, featuredBook)} at ${featuredBook.title}` : "--"}</span>
              </div>
              <div className={styles.decisionRow}>
                <span className={styles.eyebrow}>Fair Value</span>
                <span className={styles.decisionValue}>{formatOffer(event.market, featuredOutcome)}</span>
              </div>
              <div className={styles.decisionRow}>
                <span className={styles.eyebrow}>Edge</span>
                {featuredBook ? <EdgeBadge edgePct={featuredBook.edgePct} /> : <span className={styles.decisionValue}>--</span>}
              </div>
              <p className={styles.whyPickCopy}>
                <strong className={styles.whyPickLabel}>Why This Pick:</strong> {pickSummary.whyThisPick}
              </p>
              <div className={styles.noteMeta}>
                {featuredOutcome.timingSignal.label !== "Weak timing signal" ? <MovementPill outcome={featuredOutcome} /> : null}
                <ConfidencePill label={featuredOutcome.confidenceLabel} />
              </div>
            </div>

            {methodologyCopy ? <p className={styles.methodology}>{methodologyCopy}</p> : null}

            <div className={styles.backRow}>
              <Link href={`/?league=${league}&market=${event.market}&model=${model}`} className="app-link">
                Back to Board
              </Link>
            </div>
          </section>

          <section className={styles.comparisonCard}>
            {event.outcomes.map((outcome) => {
              const timelineEntry = timelineByOutcome.get(outcome.name);
              const showSignals =
                (timelineEntry?.timeline?.points.length ?? 0) >= 2 || Boolean(timelineEntry?.pressureSignals?.length);
              const sortedOutcomeBooks = sortBooks(outcome.books);
              const sharpBooks = sortedOutcomeBooks.filter((book) => book.isSharpBook || book.tier === "sharp");
              const otherBooks = sortedOutcomeBooks.filter((book) => !(book.isSharpBook || book.tier === "sharp"));

              return (
                <section key={outcome.name} className={styles.outcomeSection}>
                  <div className={styles.outcomeHeader}>
                    <div>
                      <h2 className={styles.outcomeTitle}>{outcome.name}</h2>
                      <p className={styles.outcomeCopy}>{outcome.explanation}</p>
                    </div>
                    <div className={styles.outcomePills}>
                      <EdgeBadge edgePct={strongestBook(outcome)?.edgePct ?? 0} />
                      {outcome.timingSignal.label !== "Weak timing signal" ? <MovementPill outcome={outcome} /> : null}
                    </div>
                  </div>

                  <div className={styles.bookGroups}>
                    {sharpBooks.length ? (
                      <section className={styles.bookGroup}>
                        <h3 className={styles.bookGroupTitle}>Sharp Books</h3>
                        <div className={styles.bookTable}>
                          <div className={styles.bookTableHeader}>
                            <span>Sportsbook</span>
                            <span>Line</span>
                            <span>Edge</span>
                            <span>Role</span>
                          </div>
                          {sharpBooks.map((book) => (
                            <div key={`${outcome.name}-sharp-${book.bookKey}`} className={styles.bookRow}>
                              <div className={styles.bookPrimary}>
                                <strong>{book.title}</strong>
                                <small>{book.isBestPrice ? "Best live line" : "Live board listing"}</small>
                              </div>
                              <div className={styles.bookLine}>{formatOffer(event.market, book)}</div>
                              <div className={styles.bookEdge}>
                                <EdgeBadge edgePct={book.edgePct} />
                              </div>
                              <div className={styles.bookRole}>
                                <span>{formatRole(book)}</span>
                                {book.staleSummary && book.staleFlag !== "none" ? <small>{book.staleSummary}</small> : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    ) : null}

                    {otherBooks.length ? (
                      <section className={styles.bookGroup}>
                        <h3 className={styles.bookGroupTitle}>Other Books</h3>
                        <div className={styles.bookTable}>
                          <div className={styles.bookTableHeader}>
                            <span>Sportsbook</span>
                            <span>Line</span>
                            <span>Edge</span>
                            <span>Role</span>
                          </div>
                          {otherBooks.map((book) => (
                            <div key={`${outcome.name}-other-${book.bookKey}`} className={styles.bookRow}>
                              <div className={styles.bookPrimary}>
                                <strong>{book.title}</strong>
                                <small>{book.isBestPrice ? "Best live line" : "Live board listing"}</small>
                              </div>
                              <div className={styles.bookLine}>{formatOffer(event.market, book)}</div>
                              <div className={styles.bookEdge}>
                                <EdgeBadge edgePct={book.edgePct} />
                              </div>
                              <div className={styles.bookRole}>
                                <span>{formatRole(book)}</span>
                                {book.staleSummary && book.staleFlag !== "none" ? <small>{book.staleSummary}</small> : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    ) : null}
                  </div>

                  {showSignals ? (
                    <details className={styles.disclosure}>
                      <summary className={styles.disclosureSummary}>Market Value</summary>
                      <div className={styles.disclosureBody}>
                        <EventTimelinePanel
                          outcome={outcome.name}
                          timeline={timelineEntry?.timeline || null}
                          pressureSignals={timelineEntry?.pressureSignals || []}
                        />
                      </div>
                    </details>
                  ) : null}
                </section>
              );
            })}

            {(event.excludedBooks.length || methodologyCopy) ? (
              <details className={styles.disclosure}>
                <summary className={styles.disclosureSummary}>Board Notes</summary>
                <div className={styles.disclosureBody}>
                  {methodologyCopy ? <p className={styles.disclosureCopy}>{methodologyCopy}</p> : null}
                  {event.excludedBooks.length ? (
                    <div className={styles.disclosureList}>
                      {event.excludedBooks.map((book) => (
                        <div key={`${event.id}-${book.bookKey}`} className={styles.disclosureRow}>
                          <span>{book.title}</span>
                          <small>{book.reason === "point_mismatch" ? "Equivalent line mismatch" : "Market unavailable"}</small>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </details>
            ) : null}
          </section>
        </div>
      </div>
    </AppContainer>
  );
}
