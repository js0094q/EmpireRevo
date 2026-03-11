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
import { fetchFairBoardPageData, hasOddsKey, toSportKey } from "@/lib/server/odds/pageData";
import { buildOutcomeMarketKey } from "@/lib/server/odds/snapshotPersistence";
import { buildMarketTimeline } from "@/lib/server/odds/timeline";
import { detectMarketPressureForMarket } from "@/lib/server/odds/marketPressure";
import { buildFairEventsForNormalizedEvent, LIMITED_MARKET_MIN_BOOKS } from "@/lib/server/odds/fairEngine";
import { getNormalizedOdds } from "@/lib/server/odds/oddsService";
import { eventDetailHref, formatMarketLabel, formatOffer, strongestBook, strongestOutcome } from "@/components/board/board-helpers";
import type { FairEvent, FairOutcomeBook } from "@/lib/server/odds/types";
import type { MarketKey } from "@/lib/odds/schemas";
import styles from "./page.module.css";

function formatProb(prob: number): string {
  return `${(prob * 100).toFixed(2)}%`;
}

function formatRole(book: FairOutcomeBook): string {
  if (book.tier === "sharp") return `Sharp market maker · ${book.weight.toFixed(2)}x`;
  if (book.tier === "signal") return `Signal book · ${book.weight.toFixed(2)}x`;
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

function edgeDeltaText(edgePct: number): string {
  return `${Math.abs(edgePct).toFixed(2)}% ${edgePct >= 0 ? "above" : "below"} consensus fair value`;
}

function sortBooks(books: FairOutcomeBook[]): FairOutcomeBook[] {
  return books
    .slice()
    .sort((a, b) => Number(b.isBestPrice) - Number(a.isBestPrice) || Math.abs(b.edgePct) - Math.abs(a.edgePct));
}

function pickRelatedMarketEvent(params: {
  relatedEvents: FairEvent[];
  currentEventId: string;
}): FairEvent | null {
  if (!params.relatedEvents.length) return null;
  return params.relatedEvents.find((candidate) => candidate.id === params.currentEventId) ?? params.relatedEvents[0] ?? null;
}

function findEventFromNormalized(params: {
  eventId: string;
  market: MarketKey;
  sportKey: string;
  model: "sharp" | "equal" | "weighted";
  minBooks: number;
  normalized: Awaited<ReturnType<typeof getNormalizedOdds>>["normalized"];
}): FairEvent | null {
  for (const event of params.normalized) {
    const relatedEvents = buildFairEventsForNormalizedEvent({
      normalized: event,
      sportKey: params.sportKey,
      market: params.market,
      model: params.model,
      minBooks: params.minBooks
    });
    const match = relatedEvents.find((candidate) => candidate.id === params.eventId);
    if (match) return match;
  }
  return null;
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

  const pageData = await fetchFairBoardPageData({
    league,
    market,
    model,
    windowHours: 24,
    historyWindowHours: 72,
    minBooks
  });

  if (pageData.resolvedMarket !== market) {
    const nextParams = new URLSearchParams({
      league,
      market: pageData.resolvedMarket,
      model
    });
    redirect(`/game/${encodeURIComponent(eventId)}?${nextParams.toString()}`);
  }

  const sportKey = toSportKey(league);
  const normalizedResult = await getNormalizedOdds({
    sportKey,
    regions: "us",
    markets: "h2h,spreads,totals",
    oddsFormat: "american"
  });

  const board = pageData.board;
  const eventFromBoard = board.events.find((entry) => entry.id === eventId) ?? null;
  const event =
    eventFromBoard ??
    findEventFromNormalized({
      eventId,
      market: pageData.resolvedMarket,
      sportKey,
      model,
      minBooks,
      normalized: normalizedResult.normalized
    });

  if (!event) {
    return (
      <main className="grid-shell">
        <p>Event not found in the live board.</p>
        <Link href={`/?league=${league}&market=${market}&model=${model}`}>Back to board</Link>
      </main>
    );
  }

  const sourceEvent = normalizedResult.normalized.find((entry) => entry.event.id === event.baseEventId) ?? null;
  const marketSwitchOptions = sourceEvent
    ? pageData.marketAvailability
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
          const relatedEvent = pickRelatedMarketEvent({ relatedEvents, currentEventId: event.id });
          if (!relatedEvent && availability.status === "active") return null;
          return {
            market: availability.market,
            href: relatedEvent
              ? eventDetailHref({
                  eventId: relatedEvent.id,
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
            eventId: event.id,
            league,
            market: event.market,
            model
          }),
          status: "active" as const,
          pointGroups: 1
        }
      ];
  const currentMarketSwitch = marketSwitchOptions.find((entry) => entry.market === event.market) ?? null;
  const currentMarketStatus = pageData.marketAvailability.find((entry) => entry.market === event.market)?.status ?? "active";
  const showRepresentativeNote = event.market !== "h2h" && (currentMarketSwitch?.pointGroups ?? 0) > 1;

  const featuredOutcome = strongestOutcome(event);
  const featuredBook = strongestBook(featuredOutcome);
  const methodologyCopy = board.sharpBooksUsed.length
    ? `Consensus fair prices lean on sharper market-making books when available, including ${joinTitles(board.sharpBooksUsed.slice(0, 3))}.`
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
          title="Event detail"
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
              <p className={styles.marketHint}>This market is live, but comparable line coverage is limited right now.</p>
            ) : null}

            {showRepresentativeNote ? (
              <p className={styles.marketHint}>Default market view reflects the most widely available comparable line for this matchup.</p>
            ) : null}

            <div className={styles.priceGrid}>
              <div className={styles.priceCard}>
                <span className={styles.eyebrow}>Consensus Fair Price</span>
                <strong>{formatOffer(event.market, featuredOutcome)}</strong>
                <small>{formatProb(featuredOutcome.fairProb)} fair probability</small>
              </div>
              <div className={styles.priceCard}>
                <span className={styles.eyebrow}>Best Available</span>
                <strong>{featuredBook ? formatOffer(event.market, featuredBook) : "--"}</strong>
                <small>{featuredBook ? featuredBook.title : "No live book"}</small>
              </div>
            </div>

            <div className={styles.noteCard}>
              <span className={styles.eyebrow}>Editors Note</span>
              <p className={styles.noteCopy}>
                {featuredBook
                  ? `${featuredBook.title} is pricing ${featuredOutcome.name} ${edgeDeltaText(featuredBook.edgePct)}.`
                  : "No standout dislocation is available on the current board."}
              </p>
              <div className={styles.noteMeta}>
                <EdgeBadge edgePct={featuredBook?.edgePct ?? 0} />
                {featuredOutcome.timingSignal.label !== "Weak timing signal" ? <MovementPill outcome={featuredOutcome} /> : null}
                <ConfidencePill label={featuredOutcome.confidenceLabel} />
              </div>
            </div>

            {methodologyCopy ? <p className={styles.methodology}>{methodologyCopy}</p> : null}

            <div className={styles.backRow}>
              <Link href={`/?league=${league}&market=${event.market}&model=${model}`} className="app-link">
                Back to board
              </Link>
            </div>
          </section>

          <section className={styles.comparisonCard}>
            {event.outcomes.map((outcome) => {
              const timelineEntry = timelineByOutcome.get(outcome.name);
              const showSignals =
                (timelineEntry?.timeline?.points.length ?? 0) >= 2 || Boolean(timelineEntry?.pressureSignals?.length);

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

                  <div className={styles.bookTable}>
                    <div className={styles.bookTableHeader}>
                      <span>Sportsbook</span>
                      <span>Line</span>
                      <span>Edge</span>
                      <span>Role</span>
                    </div>
                    {sortBooks(outcome.books).map((book) => (
                      <div key={`${outcome.name}-${book.bookKey}`} className={styles.bookRow}>
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

                  {showSignals ? (
                    <details className={styles.disclosure}>
                      <summary className={styles.disclosureSummary}>Market signals</summary>
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
                <summary className={styles.disclosureSummary}>Board details</summary>
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
