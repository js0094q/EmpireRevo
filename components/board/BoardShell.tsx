"use client";

import { startTransition, useDeferredValue, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { FairBoardResponse } from "@/lib/server/odds/types";
import { AppContainer } from "@/components/layout/AppContainer";
import { AppHeader } from "@/components/layout/AppHeader";
import { BrandMark } from "@/components/layout/BrandMark";
import styles from "./BoardShell.module.css";
import { BoardToolbar } from "@/components/board/BoardToolbar";
import { BoardTable } from "@/components/board/BoardTable";
import { EmptyState } from "@/components/board/EmptyState";
import { Pill } from "@/components/ui/Pill";
import {
  formatMarketLabel,
  formatUpdatedLabel,
  strongestBook,
  strongestOutcome,
  topOutcome,
  type BoardMode,
  type BoardSideKey,
  type BoardSortKey
} from "@/components/board/board-helpers";
import { filterEvents, sortEvents } from "@/components/board/selectors";
import { TeamAvatar } from "@/components/board/TeamAvatar";

type OpportunityCard = {
  key: string;
  eventId: string;
  matchup: string;
  market: string;
  team: string;
  book: string;
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
  return `${Math.abs(edgePct).toFixed(2)}% ${edgePct >= 0 ? "above" : "below"} fair value`;
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
  const topEvent = orderedEvents[0] ?? null;
  const opportunities = useMemo<OpportunityCard[]>(
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
              edgeMagnitude: Math.abs(book.edgePct),
              event
            };
          })
        )
        .filter((entry): entry is OpportunityCard => Boolean(entry))
        .sort((a, b) => b.edgeMagnitude - a.edgeMagnitude || Date.parse(a.event.commenceTime) - Date.parse(b.event.commenceTime))
        .slice(0, 3),
    [filteredEvents]
  );
  const featuredOpportunity = opportunities[0] ?? null;
  const featuredEvent = featuredOpportunity ? orderedEvents.find((event) => event.id === featuredOpportunity.eventId) ?? null : null;
  const featuredOutcome = featuredEvent ? strongestOutcome(featuredEvent) : topEvent ? topOutcome(topEvent) : null;
  const currentMarketAvailability = board.marketAvailability.find((entry) => entry.market === board.market) ?? null;
  const limitedMarkets = board.marketAvailability.filter((entry) => entry.status === "limited");
  const methodologyCopy = board.sharpBooksUsed.length
    ? `Consensus fair prices lean on sharper market-making books when available, including ${joinTitles(board.sharpBooksUsed.slice(0, 3))}.`
    : null;

  return (
    <AppContainer>
      <div className={styles.page}>
        <AppHeader
          eyebrow={mode === "games" ? "Games" : "EmpirePicks"}
          title={mode === "games" ? "Games board" : "Live board"}
          subtitle={
            mode === "games"
              ? "Focused slate view with cleaner market filters and reliable event links."
              : "Compare best line, consensus fair price, and edge in one scan."
          }
          breadcrumbs={mode === "games" ? [{ label: "Board", href: "/" }, { label: "Games" }] : undefined}
        />

        <div className={styles.stack}>
          <section className={styles.hero}>
            <div className={styles.heroPanel}>
              <div className={styles.heroBrand}>
                <div className={styles.heroBrandTop}>
                  <BrandMark />
                  <span className={styles.heroKicker}>Live Board</span>
                </div>
                <h1 className={styles.heroTitle}>EmpirePicks</h1>
                <p className={styles.heroSectionTitle}>Live Line Shopping</p>
                <p className={styles.heroSupport}>Value Focused Betting Lines</p>
                <p className={styles.heroDescription}>
                  Compare live sportsbook prices, estimate consensus fair value, and spot the market&apos;s biggest pricing gaps.
                </p>
                <p className={styles.heroTimestamp}>Updated {formatUpdatedLabel(board.updatedAt)}</p>
              </div>

              <div className={styles.heroMetrics}>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Active games</span>
                  <span className={styles.metricValue}>{orderedEvents.length}</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>Best edge</span>
                  <span className={styles.metricValue}>{featuredOpportunity ? `${featuredOpportunity.edgeMagnitude.toFixed(2)}%` : "--"}</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricLabel}>High value opportunities</span>
                  <span className={styles.metricValue}>{opportunities.length}</span>
                </div>
              </div>

              <div className={styles.definitionGrid}>
                <div className={styles.definitionItem}>
                  <span className={styles.definitionLabel}>Best Line</span>
                  <span className={styles.definitionCopy}>Strongest live sportsbook price available.</span>
                </div>
                <div className={styles.definitionItem}>
                  <span className={styles.definitionLabel}>Consensus Fair Price</span>
                  <span className={styles.definitionCopy}>No-vig estimate built from sharper books when they are live.</span>
                </div>
                <div className={styles.definitionItem}>
                  <span className={styles.definitionLabel}>Edge</span>
                  <span className={styles.definitionCopy}>Gap between the live sportsbook line and consensus fair value.</span>
                </div>
              </div>

              <div className={styles.editorCard}>
                <div className={styles.tableHeadTitle}>Editors Note</div>
                <p className={styles.editorCopy}>
                  {featuredOpportunity && featuredOutcome
                    ? `${featuredOpportunity.team} at ${featuredOpportunity.book} is the clearest current gap, with ${edgeDeltaText(
                        featuredOpportunity.edgePct
                      )}.`
                    : "The board is live, but there are no standout dislocations under the current filters."}
                </p>
                {opportunities.length ? (
                  <div className={styles.editorList}>
                    {opportunities.map((item, index) => (
                      <button
                        key={`editor-${item.key}`}
                        className={styles.editorListItem}
                        onClick={() => {
                          setExpandedEventId(item.eventId);
                          setDrawerEventId(null);
                        }}
                      >
                        <span className={styles.editorRank}>0{index + 1}</span>
                        <span className={styles.editorListCopy}>
                          {item.matchup}
                          <small>
                            {item.team} at {item.book} · {edgeDeltaText(item.edgePct)}
                          </small>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {methodologyCopy ? <p className={styles.methodologyNote}>{methodologyCopy}</p> : null}
            </div>

            <aside className={styles.heroAside}>
              <h3>High Value Opportunities</h3>
              <div className={styles.opportunityList}>
                {opportunities.map((item) => {
                  const event = item.event;
                  return (
                    <button
                      key={`opportunity-${item.key}`}
                        className={styles.opportunityItem}
                        onClick={() => {
                          setExpandedEventId(item.eventId);
                          setDrawerEventId(null);
                      }}
                    >
                      <div className={styles.opportunityTopRow}>
                        <div className={styles.opportunityMatchup}>
                          <TeamAvatar name={event.awayTeam} logoUrl={event.awayLogoUrl} size="sm" showName={false} />
                          <TeamAvatar name={event.homeTeam} logoUrl={event.homeLogoUrl} size="sm" showName={false} />
                        </div>
                        <Pill tone={item.edgePct >= 0 ? "positive" : "danger"}>{`${item.edgePct >= 0 ? "+" : ""}${item.edgePct.toFixed(2)}%`}</Pill>
                      </div>
                      <div className={styles.opportunityTop}>
                        <strong>{item.matchup}</strong>
                        <span className={styles.subtle}>{item.market}</span>
                      </div>
                      <div className={styles.opportunityMeta}>
                        <span>{item.team}</span>
                        <span>{item.book}</span>
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
              {formatMarketLabel(board.market)} has limited live availability right now. EmpirePicks is showing the board only where books are hanging comparable lines.
            </p>
          ) : limitedMarkets.length ? (
            <p className={styles.marketNote}>
              {joinTitles(limitedMarkets.map((entry) => formatMarketLabel(entry.market)))} currently have limited live availability.
            </p>
          ) : null}

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

          <p className={styles.disclosure}>{board.disclaimer}</p>
        </div>
      </div>
    </AppContainer>
  );
}
