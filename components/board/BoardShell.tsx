"use client";

import { startTransition, useDeferredValue, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { FairBoardResponse } from "@/lib/server/odds/types";
import { AppContainer } from "@/components/layout/AppContainer";
import { AppHeader } from "@/components/layout/AppHeader";
import styles from "./BoardShell.module.css";
import { BoardToolbar } from "@/components/board/BoardToolbar";
import { BoardTable } from "@/components/board/BoardTable";
import { EmptyState } from "@/components/board/EmptyState";
import { Pill } from "@/components/ui/Pill";
import {
  eventHasPartialData,
  formatUpdatedLabel,
  topBook,
  topOutcome,
  updatedMinutes,
  type BoardMode,
  type BoardSideKey,
  type BoardSortKey
} from "@/components/board/board-helpers";
import { filterEvents, sortEvents } from "@/components/board/selectors";

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
  const [staleOnly, setStaleOnly] = useState(false);
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
        staleOnly,
        highCoverageOnly: false,
        trustedBooksOnly: false,
        pinnedOnly: false,
        pinnedBooks: new Set<string>(),
        pinnedActionableEdgeThreshold: board.diagnostics.calibration.pinned.actionableEdgePct
      }),
    [allBookKeys, board.diagnostics.calibration.pinned.actionableEdgePct, board.events, deferredSearch, positiveOnly, side, staleOnly]
  );

  const orderedEvents = useMemo(() => sortEvents(filteredEvents, sortBy), [filteredEvents, sortBy]);
  const highlighted = orderedEvents.slice(0, 4);
  const topEvent = orderedEvents[0] ?? null;
  const topEventOutcome = topEvent ? topOutcome(topEvent) : null;
  const topEventBook = topEventOutcome ? topBook(topEventOutcome) : null;
  const staleMinutes = updatedMinutes(board.updatedAt);
  const partialCount = orderedEvents.filter(eventHasPartialData).length;
  const positiveCount = orderedEvents.filter((event) =>
    event.outcomes.some((outcome) => outcome.books.some((book) => book.evQualified && book.evPct > 0))
  ).length;

  return (
    <AppContainer>
      <div className={styles.page}>
        <AppHeader
          eyebrow={mode === "games" ? "Games" : "EmpirePicks"}
          title={mode === "games" ? "Games board" : "Live line shopping"}
          subtitle={
            mode === "games"
              ? "Focused slate view with mobile-first scanning and deep book context on demand."
              : "Fair-price board tuned for quick scanning, disciplined edge review, and low-noise interaction."
          }
          breadcrumbs={mode === "games" ? [{ label: "Board", href: "/" }, { label: "Games" }] : undefined}
        />

        <div className={styles.stack}>
          <section className={styles.hero}>
            <div className={styles.heroPanel}>
              <div className={styles.heroLead}>
                <h2>{topEvent ? `${topEvent.awayTeam} @ ${topEvent.homeTeam}` : "No active matchup"}</h2>
                <p>
                  {topEventOutcome && topEventBook
                    ? `${topEventOutcome.name} at ${topEventBook.title} is currently the strongest scan-first opportunity on this board.`
                    : "Adjust filters to surface a live opportunity."}
                </p>
                <div className={styles.rateNote}>
                  <Pill tone={staleMinutes > 10 ? "warning" : "accent"}>Updated {formatUpdatedLabel(board.updatedAt)}</Pill>
                  {partialCount > 0 ? <Pill tone="warning">{partialCount} partial markets</Pill> : null}
                  <Pill>{board.books.length} books tracked</Pill>
                </div>
              </div>

              <div className={styles.heroMetrics}>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Active games</span>
                  <span className={styles.metricValue}>{orderedEvents.length}</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Positive EV</span>
                  <span className={styles.metricValue}>{positiveCount}</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Best edge</span>
                  <span className={styles.metricValue}>{topEventBook ? `${topEventBook.edgePct.toFixed(2)}%` : "--"}</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Model</span>
                  <span className={styles.metricValue}>{board.model}</span>
                </div>
              </div>
            </div>

            <aside className={styles.heroAside}>
              <h3>Worth opening</h3>
              <div className={styles.opportunityList}>
                {highlighted.map((event) => {
                  const outcome = topOutcome(event);
                  const book = topBook(outcome);
                  return (
                    <button
                      key={`opportunity-${event.id}`}
                      className={styles.opportunityItem}
                      onClick={() => {
                        setExpandedEventId(event.id);
                        setDrawerEventId(null);
                      }}
                    >
                      <div className={styles.opportunityTop}>
                        <span>
                          {event.awayTeam} @ {event.homeTeam}
                        </span>
                        {book ? <Pill tone={book.edgePct > 0 ? "positive" : "neutral"}>{book.edgePct.toFixed(2)}%</Pill> : null}
                      </div>
                      <div className={styles.opportunityMeta}>
                        <Pill tone="accent">{outcome.name}</Pill>
                        <Pill>{outcome.bestBook}</Pill>
                        <Pill>{event.confidenceLabel}</Pill>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>
          </section>

          <BoardToolbar
            league={league}
            market={board.market}
            windowKey={windowKey}
            sortBy={sortBy}
            search={search}
            side={side}
            positiveOnly={positiveOnly}
            staleOnly={staleOnly}
            onLeagueChange={(value) => replaceParam("league", value)}
            onMarketChange={(value) => replaceParam("market", value)}
            onWindowChange={(value) => replaceParam("window", value)}
            onSortChange={setSortBy}
            onSearchChange={setSearch}
            onSideChange={setSide}
            onTogglePositive={() => setPositiveOnly((value) => !value)}
            onToggleStale={() => setStaleOnly((value) => !value)}
            onRefresh={() => router.refresh()}
          />

          <section className={styles.summaryGrid}>
            {staleMinutes > 10 ? <Pill tone="warning">Odds may be stale</Pill> : <Pill tone="positive">Feed is fresh</Pill>}
            {partialCount > 0 ? <Pill tone="warning">Some books are missing equivalent lines</Pill> : <Pill>Full market coverage on visible games</Pill>}
            <Pill>{board.disclaimer}</Pill>
          </section>

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
              message="Try a broader search, switch market, or clear positive-EV and stale-only constraints."
              actionLabel="Reset filters"
              onAction={() => {
                setSearch("");
                setPositiveOnly(false);
                setStaleOnly(false);
                setSide("all");
              }}
            />
          )}
        </div>
      </div>
    </AppContainer>
  );
}
