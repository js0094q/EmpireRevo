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
import { cn } from "@/lib/ui/cn";

type OpportunityCard = {
  key: string;
  eventId: string;
  matchup: string;
  market: string;
  team: string;
  book: string;
  edgePct: number;
  scoreMagnitude: number;
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
  return `Market Mispricing: ${team} Overpriced`;
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
              edgePct: book.edgePct,
              scoreMagnitude: Math.abs(book.edgePct),
              event
            };
          })
        )
        .filter((entry): entry is OpportunityCard => Boolean(entry))
        .sort((a, b) => b.scoreMagnitude - a.scoreMagnitude || Date.parse(a.event.commenceTime) - Date.parse(b.event.commenceTime)),
    [filteredEvents]
  );

  const opportunities = rankedOpportunities.slice(0, 4);
  const currentMarketAvailability = board.marketAvailability.find((entry) => entry.market === board.market) ?? null;
  const limitedMarkets = board.marketAvailability.filter((entry) => entry.status === "limited");
  const sharpReferenceTitles = board.sharpBooksUsed.slice(0, 3);
  const sharpReferenceNote =
    sharpReferenceTitles.length > 0
      ? `Sharp books are weighted as reference prices when available (${joinTitles(sharpReferenceTitles)}).`
      : "Sharp books are weighted as reference prices when available.";
  const disclosureCopy = board.disclaimer.replace("Market intelligence only.", "Compare prices only.");

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
            <p className={styles.heroLead}>Compare prices, fair value, and edge across active books.</p>
          </section>

          <section className={styles.opportunitySection}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Top Opportunities</p>
                <h2 className={styles.sectionTitle}>Highest Value Right Now</h2>
              </div>
            </div>

            {opportunities.length ? (
              <div className={styles.opportunityGrid}>
                {opportunities.map((item) => {
                  const event = item.event;
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
                        <div className={styles.opportunityMatchup}>
                          <div className={styles.matchupTeams}>
                            <TeamAvatar name={event.awayTeam} logoUrl={event.awayLogoUrl} size="sm" showName={false} />
                            <TeamAvatar name={event.homeTeam} logoUrl={event.homeLogoUrl} size="sm" showName={false} />
                          </div>
                          <strong>{item.matchup}</strong>
                        </div>
                        <span className={styles.metaText}>{formatCommenceTime(event.commenceTime)}</span>
                      </div>
                      <p className={styles.opportunityDirective}>{directiveText(item.team, item.edgePct)}</p>
                      <div className={styles.opportunityPrimary}>
                        <strong>{item.team}</strong>
                        <span className={styles.metaSeparator}>|</span>
                        <span className={styles.metaText}>{item.book}</span>
                      </div>
                      <p className={styles.metaText}>{item.market}</p>
                      <p className={cn(styles.edgePrimary, item.edgePct < 0 ? styles.edgePrimaryNegative : item.edgePct >= 1.5 ? styles.edgePrimaryStrong : item.edgePct >= 0.75 ? styles.edgePrimaryModerate : styles.edgePrimaryMuted)}>
                        {`${item.edgePct > 0 ? "+" : ""}${item.edgePct.toFixed(2)}%`}
                      </p>
                      <p className={styles.metaText}>{edgeDeltaText(item.edgePct)}</p>
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
                <p className={styles.sectionEyebrow}>Board</p>
                <h2 className={styles.sectionTitle}>Live Line Shopping</h2>
                <p className={styles.sectionMuted}>Scan edge-first rows to find value faster.</p>
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
            {sortBy === "edge" ? <p className={styles.sortReminder}>Sorted by Value</p> : null}

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
                message="Try a broader search, switch market, or clear the Positive Edge filter."
                actionLabel="Reset filters"
                onAction={() => {
                  setSearch("");
                  setPositiveOnly(false);
                  setSide("all");
                }}
              />
            )}
          </section>

          <p className={styles.disclosure}>{disclosureCopy}</p>
        </div>
      </div>
    </AppContainer>
  );
}
