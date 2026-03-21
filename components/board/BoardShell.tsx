"use client";

import Link from "next/link";
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
  buildOutcomeSummary,
  eventDetailHref,
  formatCommenceTime,
  formatMarketLabel,
  formatOffer,
  formatUpdatedLabel,
  type BoardMode,
  type BoardSideKey,
  type BoardSortKey
} from "@/components/board/board-helpers";
import { filterEvents, sortEvents } from "@/components/board/selectors";
import { TeamAvatar } from "@/components/board/TeamAvatar";
import { cn } from "@/lib/ui/cn";

type OpportunityCard = {
  key: string;
  matchup: string;
  market: string;
  team: string;
  status: "Favorite" | "Underdog";
  label: "Recommended Pick" | "Current Best Number";
  lineLabel: string;
  fairLabel: string;
  book: string;
  edgePct: number;
  whyThisPick: string;
  href: string;
  event: FairBoardResponse["events"][number];
};

function joinTitles(values: string[]): string {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
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
  const [positiveEdgeOnly, setPositiveEdgeOnly] = useState(false);
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
  const windowFilter = windowKey === "today" ? "12h" : "24h";

  const filteredEvents = useMemo(
    () =>
      filterEvents(board.events, {
        teamQuery: deferredSearch,
        visibleBookKeys: allBookKeys,
        edgeThresholdPct: 0,
        minContributingBooks: 1,
        minConfidenceScore: 0,
        minSharpParticipation: 0,
        startWindow: windowFilter,
        positiveEdgeOnly,
        sideFilter: side,
        bestEdgesOnly: false,
        staleOnly: false,
        highCoverageOnly: false,
        trustedBooksOnly: false,
        pinnedOnly: false,
        pinnedBooks: new Set<string>(),
        pinnedActionableEdgeThreshold: board.diagnostics.calibration.pinned.actionableEdgePct
      }),
    [allBookKeys, board.diagnostics.calibration.pinned.actionableEdgePct, board.events, deferredSearch, positiveEdgeOnly, side, windowFilter]
  );

  const orderedEvents = useMemo(() => sortEvents(filteredEvents, sortBy), [filteredEvents, sortBy]);
  const filteredEventIds = useMemo(() => new Set(filteredEvents.map((event) => event.id)), [filteredEvents]);
  const eventsById = useMemo(() => new Map(board.events.map((event) => [event.id, event])), [board.events]);

  const rankedOpportunities = useMemo<OpportunityCard[]>(
    () => {
      const cards: OpportunityCard[] = [];

      for (const opportunity of board.topOpportunities) {
        if (!filteredEventIds.has(opportunity.eventId)) continue;
        const event = eventsById.get(opportunity.eventId);
        if (!event) continue;
        const outcome = event.outcomes.find((candidate) => candidate.name === opportunity.outcome);
        if (!outcome) continue;

        const pick = buildOutcomeSummary(outcome);
        if (positiveEdgeOnly && (pick.book?.edgePct ?? 0) <= 0) continue;
        if (side === "favored" && pick.status !== "Favorite") continue;
        if (side === "underdogs" && pick.status !== "Underdog") continue;

        cards.push({
          key: `${opportunity.eventId}:${opportunity.outcome}`,
          matchup: `${event.awayTeam} @ ${event.homeTeam}`,
          market: event.market === "h2h" ? "Moneyline" : event.market === "spreads" ? "Spread" : "Total",
          team: outcome.name,
          status: pick.status,
          label: pick.label,
          lineLabel: pick.book ? formatOffer(event.market, pick.book) : "--",
          fairLabel: formatOffer(event.market, outcome),
          book: pick.book?.title ?? opportunity.bestBook,
          edgePct: pick.book?.edgePct ?? opportunity.edgePct,
          whyThisPick: pick.whyThisPick,
          href: eventDetailHref({
            event,
            league,
            market: event.market,
            model: board.model
          }),
          event
        });
      }

      return cards;
    },
    [board.model, board.topOpportunities, eventsById, filteredEventIds, league, positiveEdgeOnly, side]
  );

  const opportunities = rankedOpportunities.slice(0, 4);
  const currentMarketAvailability = board.marketAvailability.find((entry) => entry.market === board.market) ?? null;
  const limitedMarkets = board.marketAvailability.filter((entry) => entry.status === "limited");
  const sharpReferenceTitles = board.sharpBooksUsed.slice(0, 3);
  const sharpReferenceNote =
    sharpReferenceTitles.length > 0
      ? `Sharp books are used as reference prices when available (${joinTitles(sharpReferenceTitles)}).`
      : "Sharp books are used as reference prices when available.";
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
                    <Link
                      key={`opportunity-${item.key}`}
                      href={item.href}
                      className={cn(styles.opportunityItem, item.edgePct >= 0 ? styles.opportunityItemPositive : styles.opportunityItemNegative)}
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
                      <div className={styles.recommendationRow}>
                        <span className={styles.cellLabel}>{item.label}</span>
                        <span className={styles.pickStatus}>{item.status}</span>
                      </div>
                      <div className={styles.opportunityPrimary}>
                        <strong>{item.team}</strong>
                      </div>
                      <p className={styles.metaText}>{`Best Available Line: ${item.lineLabel} at ${item.book}`}</p>
                      <p className={styles.metaText}>{`Fair Value: ${item.fairLabel}`}</p>
                      <p className={styles.metaText}>{item.market}</p>
                      <p
                        className={cn(
                          styles.edgePrimary,
                          item.edgePct < 0
                            ? styles.edgePrimaryNegative
                            : item.edgePct >= 1.5
                              ? styles.edgePrimaryStrong
                              : item.edgePct >= 0.75
                                ? styles.edgePrimaryModerate
                                : styles.edgePrimaryMuted
                        )}
                      >
                        {`${item.edgePct > 0 ? "+" : ""}${item.edgePct.toFixed(2)}%`}
                      </p>
                      <p className={styles.whyPickCopy}>
                        <strong className={styles.whyPickLabel}>Why This Pick:</strong> {item.whyThisPick}
                      </p>
                      <span className={styles.inlineCta}>View Game Detail</span>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className={styles.sectionMuted}>No standout opportunities right now. Use filters below to scan the full board.</p>
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
              positiveEdgeOnly={positiveEdgeOnly}
              onLeagueChange={(value) => replaceParam("league", value)}
              onMarketChange={(value) => replaceParam("market", value)}
              onWindowChange={(value) => replaceParam("window", value)}
              onSortChange={setSortBy}
              onSearchChange={setSearch}
              onSideChange={setSide}
              onTogglePositive={() => setPositiveEdgeOnly((value) => !value)}
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
                league={league}
                model={board.model}
              />
            ) : (
              <EmptyState
                title="No games match the current filters"
                message="Try a broader search, switch market, or clear the Positive Edge filter."
                actionLabel="Reset filters"
                onAction={() => {
                  setSearch("");
                  setPositiveEdgeOnly(false);
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
