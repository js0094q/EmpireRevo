"use client";

import { startTransition, useDeferredValue, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { FairBoardResponse } from "@/lib/server/odds/types";
import { AppContainer } from "@/components/layout/AppContainer";
import { BrandMark } from "@/components/layout/BrandMark";
import styles from "./BoardShell.module.css";
import { BoardToolbar } from "@/components/board/BoardToolbar";
import { BoardTable } from "@/components/board/BoardTable";
import { EmptyState } from "@/components/board/EmptyState";
import {
  formatCommenceTime,
  formatMarketLabel,
  formatUpdatedLabel,
  strongestBook,
  type BoardMode,
  type BoardSideKey,
  type BoardSortKey
} from "@/components/board/board-helpers";
import { filterEvents, sortEvents } from "@/components/board/selectors";
import { TeamAvatar } from "@/components/board/TeamAvatar";
import { EdgeBadge, getEdgeTierLabel } from "@/components/board/EdgeBadge";
import { cn } from "@/lib/ui/cn";
import { Pill } from "@/components/ui/Pill";

type OpportunityCard = {
  key: string;
  eventId: string;
  matchup: string;
  market: string;
  team: string;
  book: string;
  isSharpBook: boolean;
  edgePct: number;
  edgeMagnitude: number;
  event: FairBoardResponse["events"][number];
};

function joinTitles(values: string[]): string {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function edgeDeltaText(edgePct: number): string {
  return edgePct >= 0 ? "Better than market average" : "Overpriced at this book";
}

function directiveText(team: string, edgePct: number): string {
  if (edgePct >= 0) return `Best Bet: ${team}`;
  return `Market Mispricing: ${team} overpriced`;
}

type BoardShellProps = {
  board: FairBoardResponse;
  league: string;
  windowKey: "today" | "next24";
  mode?: BoardMode;
};

export function BoardShell({ board, league, windowKey, mode = "board" }: BoardShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sortBy, setSortBy] = useState<BoardSortKey>("score");
  const [search, setSearch] = useState("");
  const [side, setSide] = useState<BoardSideKey>("all");
  const [positiveOnly, setPositiveOnly] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [drawerEventId, setDrawerEventId] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  function replaceParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set(key, value);
    const path = mode === "games" ? "/games" : "/";
    startTransition(() => {
      router.replace(`${path}${params.toString() ? `?${params.toString()}` : ""}`);
    });
  }

  const allBookKeys = useMemo(() => new Set(board.books.map((book) => book.key)), [board.books]);

  const filteredEvents = useMemo(
    () =>
      filterEvents(board.events, {
        teamQuery: deferredSearch,
        visibleBookKeys: allBookKeys,
        edgeThresholdPct: 0,
        minContributingBooks: 1,
        minConfidenceScore: 0,
        minSharpParticipation: 0,
        startWindow: "all",
        positiveEvOnly: positiveOnly,
        sideFilter: side,
        bestEdgesOnly: false,
        staleOnly: false,
        highCoverageOnly: false,
        trustedBooksOnly: false,
        pinnedOnly: false,
        pinnedBooks: new Set<string>(),
        pinnedActionableEdgeThreshold: board.diagnostics.calibration.pinned.actionableEdgePct
      }),
    [allBookKeys, board.diagnostics.calibration.pinned.actionableEdgePct, board.events, deferredSearch, positiveOnly, side]
  );

  const orderedEvents = useMemo(() => sortEvents(filteredEvents, sortBy), [filteredEvents, sortBy]);

  const rankedOpportunities = useMemo<OpportunityCard[]>(
    () =>
      filteredEvents
        .flatMap((event) =>
          event.outcomes.map((outcome) => {
            const book = strongestBook(outcome);
            if (!book) return null;
            return {
              key: `${event.id}:${outcome.name}:${book.bookKey}`,
              eventId: event.id,
              matchup: `${event.awayTeam} @ ${event.homeTeam}`,
              market: event.market === "h2h" ? "Moneyline" : event.market === "spreads" ? "Spread" : "Total",
              team: outcome.name,
              book: book.title,
              isSharpBook: book.isSharpBook || book.tier === "sharp",
              edgePct: book.edgePct,
              edgeMagnitude: Math.abs(book.edgePct),
              event
            };
          })
        )
        .filter((entry): entry is OpportunityCard => Boolean(entry))
        .sort((a, b) => b.edgeMagnitude - a.edgeMagnitude || Date.parse(a.event.commenceTime) - Date.parse(b.event.commenceTime)),
    [filteredEvents]
  );

  const opportunities = rankedOpportunities.slice(0, 4);
  const currentMarketAvailability = board.marketAvailability.find((entry) => entry.market === board.market) ?? null;
  const limitedMarkets = board.marketAvailability.filter((entry) => entry.status === "limited");
  const sharpReferenceTitles = board.sharpBooksUsed.slice(0, 3);
  const sharpReferenceNote =
    sharpReferenceTitles.length > 0
      ? `Sharp books are used as stronger market reference points when available (${joinTitles(sharpReferenceTitles)}).`
      : "Sharp books are used as stronger market reference points when available.";

  return (
    <AppContainer>
      <div className={styles.page}>
        <div className={styles.stack}>
          <section className={styles.heroPanel}>
            <div className={styles.heroTopRow}>
              <div className={styles.heroBrand}>
                <BrandMark className={styles.heroBrandMark} />
                <div className={styles.heroBrandCopy}>
                  <h1 className={styles.heroTitle}>EmpirePicks</h1>
                  <p className={styles.heroSubhead}>Live Line Shopping</p>
                </div>
              </div>
              <span className={styles.summaryTimestamp}>Updated {formatUpdatedLabel(board.updatedAt)}</span>
            </div>
            <p className={styles.heroLead}>Compare sportsbook prices, estimate fair value, and spot where the market is mispriced.</p>
            <div className={styles.definitionRow}>
              <div className={styles.definitionItem}>
                <span className={styles.definitionTerm}>Best Line</span>
                <span className={styles.definitionCopy}>strongest sportsbook price</span>
              </div>
              <div className={styles.definitionItem}>
                <span className={styles.definitionTerm}>Fair Value</span>
                <span className={styles.definitionCopy}>consensus market estimate</span>
              </div>
              <div className={styles.definitionItem}>
                <span className={styles.definitionTerm}>Edge</span>
                <span className={styles.definitionCopy}>difference between sportsbook and fair value</span>
              </div>
            </div>
          </section>

          <section className={styles.opportunitySection}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Top Opportunities</p>
                <h2 className={styles.sectionTitle}>Best prices right now</h2>
              </div>
            </div>

            {opportunities.length ? (
              <div className={styles.opportunityGrid}>
                {opportunities.map((item) => {
                  const event = item.event;
                  const edgeTierLabel = item.edgePct >= 0 ? getEdgeTierLabel(item.edgePct) : null;
                  return (
                    <button
                      key={`opportunity-${item.key}`}
                      className={cn(styles.opportunityItem, item.edgePct >= 0 ? styles.opportunityItemPositive : styles.opportunityItemNegative)}
                      onClick={() => {
                        setExpandedEventId(item.eventId);
                        setDrawerEventId(null);
                      }}
                    >
                      <div className={styles.opportunityTopRow}>
                        <span className={styles.subtle}>{formatCommenceTime(event.commenceTime)}</span>
                        <EdgeBadge edgePct={item.edgePct} />
                      </div>
                      <div className={styles.opportunityMatchup}>
                        <div className={styles.matchupTeams}>
                          <TeamAvatar name={event.awayTeam} logoUrl={event.awayLogoUrl} size="sm" showName={false} />
                          <TeamAvatar name={event.homeTeam} logoUrl={event.homeLogoUrl} size="sm" showName={false} />
                        </div>
                        <strong>{item.matchup}</strong>
                      </div>
                      <p className={styles.opportunityDirective}>{directiveText(item.team, item.edgePct)}</p>
                      <div className={styles.opportunityMeta}>
                        <span className={styles.metaKey}>Top Side:</span>
                        <span>{item.team}</span>
                        <span className={styles.metaKey}>Book:</span>
                        <span>{item.book}</span>
                        <span className={styles.metaKey}>Market:</span>
                        <span>{item.market}</span>
                        {item.isSharpBook ? (
                          <span
                            className={styles.sharpBookBadge}
                            title="Sharp books reflect more efficient market pricing and are often used as reference points."
                          >
                            <span className={styles.sharpBookBadgeDot} aria-hidden="true" />
                            Sharp Book
                          </span>
                        ) : null}
                      </div>
                      <p className={styles.opportunityCopy}>
                        {`Edge ${item.edgePct > 0 ? "+" : ""}${item.edgePct.toFixed(2)}%`}
                        {edgeTierLabel ? <span className={styles.edgeTierHint}>{edgeTierLabel}</span> : null}
                        {` · ${edgeDeltaText(item.edgePct)}`}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className={styles.sectionMuted}>No standout opportunities right now. Use filters below to expand the board.</p>
            )}
          </section>

          <section className={styles.liveBoardSection}>
            <div className={styles.liveBoardHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Live Board</p>
                <h2 className={styles.sectionTitle}>Line comparison board</h2>
                <p className={styles.sectionMuted}>Filter by league, market, time, and sort order to find the most actionable prices.</p>
              </div>
            </div>

            <BoardToolbar
              league={league}
              market={board.market}
              marketAvailability={board.marketAvailability}
              windowKey={windowKey}
              sortBy={sortBy}
              search={search}
              side={side}
              positiveOnly={positiveOnly}
              onLeagueChange={(value) => replaceParam("league", value)}
              onMarketChange={(value) => replaceParam("market", value)}
              onWindowChange={(value) => replaceParam("window", value)}
              onSortChange={setSortBy}
              onSearchChange={setSearch}
              onSideChange={setSide}
              onTogglePositive={() => setPositiveOnly((value) => !value)}
              onRefresh={() => router.refresh()}
            />

            {currentMarketAvailability?.status === "limited" ? (
              <p className={styles.marketNote}>
                {formatMarketLabel(board.market)} has limited live availability. Showing only comparable two-sided prices currently in the feed.
              </p>
            ) : limitedMarkets.length ? (
              <p className={styles.marketNote}>
                {joinTitles(limitedMarkets.map((entry) => formatMarketLabel(entry.market)))} currently have limited live availability.
              </p>
            ) : null}
            <p className={styles.marketNote}>{sharpReferenceNote}</p>
            {sortBy === "edge" ? <p className={styles.sortReminder}>Sorted by Best Value</p> : null}

            {orderedEvents.length ? (
              <BoardTable
                events={orderedEvents}
                expandedEventId={expandedEventId}
                drawerEventId={drawerEventId}
                league={league}
                model={board.model}
                onToggleExpanded={(eventId) => setExpandedEventId((current) => (current === eventId ? null : eventId))}
                onOpenDrawer={setDrawerEventId}
                onCloseDrawer={() => setDrawerEventId(null)}
              />
            ) : (
              <EmptyState
                title="No games match the current filters"
                message="Try a broader search, switch market, or clear the value-only filter."
                actionLabel="Reset filters"
                onAction={() => {
                  setSearch("");
                  setPositiveOnly(false);
                  setSide("all");
                }}
              />
            )}
          </section>

          <p className={styles.disclosure}>{board.disclaimer}</p>
        </div>
      </div>
    </AppContainer>
  );
}
