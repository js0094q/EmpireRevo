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
import { EdgeBadge } from "@/components/board/EdgeBadge";
import { cn } from "@/lib/ui/cn";

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
  outcome: FairBoardResponse["events"][number]["outcomes"][number];
};

function joinTitles(values: string[]): string {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function edgeDeltaText(edgePct: number): string {
  return `${Math.abs(edgePct).toFixed(2)}% ${edgePct >= 0 ? "above" : "below"} fair value`;
}

function firstSentence(text: string): string {
  const delimiters = [". ", "! ", "? "];
  const indexes = delimiters.map((delimiter) => text.indexOf(delimiter)).filter((index) => index >= 0);
  const end = indexes.length ? Math.min(...indexes) + 1 : -1;
  return end > 0 ? text.slice(0, end) : text;
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
              edgeMagnitude: Math.abs(book.edgePct),
              event,
              outcome
            };
          })
        )
        .filter((entry): entry is OpportunityCard => Boolean(entry))
        .sort((a, b) => b.edgeMagnitude - a.edgeMagnitude || Date.parse(a.event.commenceTime) - Date.parse(b.event.commenceTime)),
    [filteredEvents]
  );

  const opportunities = rankedOpportunities.slice(0, 3);
  const featuredOpportunity = rankedOpportunities.find((item) => item.edgePct > 0) ?? rankedOpportunities[0] ?? null;
  const featuredEvent = featuredOpportunity
    ? orderedEvents.find((event) => event.id === featuredOpportunity.eventId) ?? null
    : topEvent;
  const featuredOutcome = featuredOpportunity?.outcome ?? (featuredEvent ? topOutcome(featuredEvent) : null);
  const currentMarketAvailability = board.marketAvailability.find((entry) => entry.market === board.market) ?? null;
  const limitedMarkets = board.marketAvailability.filter((entry) => entry.status === "limited");
  const methodologyCopy = board.sharpBooksUsed.length
    ? `Consensus fair prices prioritize market-making books such as ${joinTitles(board.sharpBooksUsed.slice(0, 3))}.`
    : null;

  const highValueCount = rankedOpportunities.filter((item) => item.edgePct >= 1).length;
  const positiveSignalCount = rankedOpportunities.filter((item) => item.edgePct >= 0.5).length;
  const negativeSignalCount = rankedOpportunities.filter((item) => item.edgePct <= -0.5).length;
  const likelyClosingCount = filteredEvents.filter((event) => event.timingLabel === "Likely closing").length;
  const weakTimingCount = filteredEvents.filter((event) => event.timingLabel === "Weak timing signal").length;
  const averageCoveragePct =
    filteredEvents.length > 0
      ? (filteredEvents.reduce((sum, event) => sum + (event.totalBookCount ? event.contributingBookCount / event.totalBookCount : 0), 0) /
          filteredEvents.length) *
        100
      : 0;

  const marketSummary = featuredOpportunity
    ? `${formatMarketLabel(board.market)} markets show ${orderedEvents.length} active games, with ${highValueCount} opportunities currently above a +1.00% edge threshold. ${featuredOpportunity.team} at ${featuredOpportunity.book} is leading the board at ${edgeDeltaText(featuredOpportunity.edgePct)}.`
    : `${formatMarketLabel(board.market)} markets are live with ${orderedEvents.length} active games, but no clear dislocations under current filters.`;

  const analysisContext =
    weakTimingCount > 0
      ? `${weakTimingCount} matchups are currently tagged with weak timing signals, so prioritize price quality over urgency on those spots.`
      : "Timing pressure is stable across the current board, with no broad weak-signal cluster right now.";

  return (
    <AppContainer>
      <div className={styles.page}>
        <AppHeader
          eyebrow={mode === "games" ? "Games" : "EmpirePicks"}
          title={mode === "games" ? "Games board" : "Live board"}
          subtitle={
            mode === "games"
              ? "Focused slate view with cleaner market filters and reliable event links."
              : "Market intelligence first, then scanner-level line shopping detail."
          }
          breadcrumbs={mode === "games" ? [{ label: "Board", href: "/" }, { label: "Games" }] : undefined}
        />

        <div className={styles.stack}>
          <section className={styles.intelligenceGrid}>
            <section className={styles.summaryPanel}>
              <div className={styles.summaryHeader}>
                <div>
                  <div className={styles.sectionEyebrow}>Market Summary</div>
                  <h1 className={styles.summaryTitle}>Live Market Intelligence</h1>
                  <p className={styles.summaryLead}>Spot where books are disconnected from fair value before drilling into row-level pricing.</p>
                </div>
                <div className={styles.summaryBrand}>
                  <BrandMark />
                  <span className={styles.summaryTimestamp}>Updated {formatUpdatedLabel(board.updatedAt)}</span>
                </div>
              </div>

              <div className={styles.metricGrid}>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Active games</span>
                  <span className={styles.metricValue}>{orderedEvents.length}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Best edge</span>
                  <span className={styles.metricValue}>{featuredOpportunity ? `${featuredOpportunity.edgeMagnitude.toFixed(2)}%` : "--"}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>High-value opportunities</span>
                  <span className={styles.metricValue}>{highValueCount}</span>
                </div>
                <div className={styles.metricCard}>
                  <span className={styles.metricLabel}>Coverage</span>
                  <span className={styles.metricValue}>{`${averageCoveragePct.toFixed(0)}%`}</span>
                </div>
              </div>

              <div className={styles.pulseRow}>
                <Pill tone="positive">Positive edges {positiveSignalCount}</Pill>
                <Pill tone="danger">Negative edges {negativeSignalCount}</Pill>
                <Pill tone={likelyClosingCount > 0 ? "warning" : "neutral"}>Likely closing {likelyClosingCount}</Pill>
              </div>
            </section>

            <aside className={styles.featuredPanel}>
              <div className={styles.sectionEyebrow}>Featured Opportunity</div>
              {featuredOpportunity && featuredEvent && featuredOutcome ? (
                <button
                  className={styles.featuredButton}
                  onClick={() => {
                    setExpandedEventId(featuredOpportunity.eventId);
                    setDrawerEventId(null);
                  }}
                >
                  <div className={styles.featuredTopRow}>
                    <div className={styles.matchupTeams}>
                      <TeamAvatar name={featuredEvent.awayTeam} logoUrl={featuredEvent.awayLogoUrl} size="md" showName={false} />
                      <TeamAvatar name={featuredEvent.homeTeam} logoUrl={featuredEvent.homeLogoUrl} size="md" showName={false} />
                    </div>
                    <EdgeBadge edgePct={featuredOpportunity.edgePct} size="lg" />
                  </div>
                  <div className={styles.featuredMatchup}>{featuredOpportunity.matchup}</div>
                  <div className={styles.featuredMeta}>
                    <span>{featuredOpportunity.team}</span>
                    <span>{featuredOpportunity.book}</span>
                    <span>{featuredOutcome.timingSignal.label}</span>
                  </div>
                  <p className={styles.featuredCopy}>{firstSentence(featuredOutcome.explanation)}</p>
                </button>
              ) : (
                <div className={styles.featuredEmpty}>No featured opportunity under the current filters.</div>
              )}
            </aside>
          </section>

          <section className={styles.analysisPanel}>
            <div className={styles.analysisHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Editors Note</p>
                <h2 className={styles.sectionTitle}>Curated board read</h2>
              </div>
              {featuredOpportunity ? <EdgeBadge edgePct={featuredOpportunity.edgePct} /> : null}
            </div>

            <p className={styles.analysisCopy}>{marketSummary}</p>
            {methodologyCopy ? <p className={styles.analysisContext}>{methodologyCopy}</p> : null}
            <p className={styles.analysisContext}>{analysisContext}</p>

            {opportunities.length ? (
              <div className={styles.analysisList}>
                {opportunities.map((item, index) => (
                  <button
                    key={`editor-${item.key}`}
                    className={styles.analysisItem}
                    onClick={() => {
                      setExpandedEventId(item.eventId);
                      setDrawerEventId(null);
                    }}
                  >
                    <span className={styles.analysisRank}>{`0${index + 1}`}</span>
                    <span className={styles.analysisItemBody}>
                      <span className={styles.analysisItemTop}>
                        <strong>{item.matchup}</strong>
                        <EdgeBadge edgePct={item.edgePct} />
                      </span>
                      <small>
                        {item.team} at {item.book} · {edgeDeltaText(item.edgePct)} · {item.outcome.timingSignal.label}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section className={styles.opportunitySection}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Top Opportunities</p>
                <h2 className={styles.sectionTitle}>Fast edge scan</h2>
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
                          <TeamAvatar name={event.awayTeam} logoUrl={event.awayLogoUrl} size="sm" showName={false} />
                          <TeamAvatar name={event.homeTeam} logoUrl={event.homeLogoUrl} size="sm" showName={false} />
                        </div>
                        <EdgeBadge edgePct={item.edgePct} />
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
            ) : (
              <p className={styles.sectionMuted}>No standout opportunities right now. Use filters below to expand the board.</p>
            )}
          </section>

          <section className={styles.liveBoardSection}>
            <div className={styles.liveBoardHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Live Board</p>
                <h2 className={styles.sectionTitle}>Scanner</h2>
                <p className={styles.sectionMuted}>
                  Search, sort, and expand matchups to inspect full book-by-book pricing without leaving the board.
                </p>
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
          </section>

          <p className={styles.disclosure}>{board.disclaimer}</p>
        </div>
      </div>
    </AppContainer>
  );
}
