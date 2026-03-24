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
  formatMarketLabel,
  formatUpdatedLabel,
  type BoardNavigationContext,
  type BoardMode,
  type BoardSideKey
} from "@/components/board/board-helpers";
import { filterEvents, sortEvents } from "@/components/board/selectors";

function joinTitles(values: string[]): string {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function parseSideParam(value: string | null): BoardSideKey {
  if (value === "favored" || value === "underdogs") return value;
  return "all";
}

function parseSearchParam(value: string | null): string {
  return (value || "").trim();
}

function parsePositiveEdgeParam(value: string | null): boolean {
  return value === "1" || value === "true";
}

type BoardShellProps = {
  board: FairBoardResponse;
  league: string;
  mode?: BoardMode;
};

export function BoardShell({ board, league, mode = "board" }: BoardShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(() => parseSearchParam(searchParams?.get("search") ?? null));
  const [side, setSide] = useState<BoardSideKey>(() => parseSideParam(searchParams?.get("side") ?? null));
  const [positiveEdgeOnly, setPositiveEdgeOnly] = useState(() => parsePositiveEdgeParam(searchParams?.get("edge") ?? null));
  const deferredSearch = useDeferredValue(search);

  const navigationContext = useMemo<BoardNavigationContext>(
    () => ({
      mode,
      windowKey: "all",
      side,
      search,
      positiveEdgeOnly
    }),
    [mode, positiveEdgeOnly, search, side]
  );

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
    [allBookKeys, board.diagnostics.calibration.pinned.actionableEdgePct, board.events, deferredSearch, positiveEdgeOnly, side]
  );

  const orderedEvents = useMemo(() => sortEvents(filteredEvents, "soonest"), [filteredEvents]);

  const currentMarketAvailability = board.marketAvailability.find((entry) => entry.market === board.market) ?? null;
  const limitedMarkets = board.marketAvailability.filter((entry) => entry.status === "limited");
  const sharpReferenceTitles = board.sharpBooksUsed.slice(0, 3);
  const sharpReferenceNote =
    sharpReferenceTitles.length > 0
      ? `Sharp books are weighted in model fair value when available (${joinTitles(sharpReferenceTitles)}).`
      : "Sharp books are weighted in model fair value when available.";
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
                  <p className={styles.sectionEyebrow}>EmpirePicks</p>
                  <h1 className={styles.heroTitle}>Board Workspace</h1>
                  <p className={styles.heroSubhead}>Live pricing terminal for fast betting decisions.</p>
                </div>
              </div>
              <span className={styles.summaryTimestamp}>Updated {formatUpdatedLabel(board.updatedAt)}</span>
            </div>
            <p className={styles.heroLead}>Recommended side first, then market price, model fair value, and edge.</p>
          </section>

          <section className={styles.liveBoardSection}>
            <div className={styles.liveBoardHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Board</p>
                <h2 className={styles.sectionTitle}>Live Line Shopping</h2>
              </div>
            </div>

            <BoardToolbar
              league={league}
              market={board.market}
              marketAvailability={board.marketAvailability}
              search={search}
              side={side}
              positiveEdgeOnly={positiveEdgeOnly}
              onLeagueChange={(value) => replaceParam("league", value)}
              onMarketChange={(value) => replaceParam("market", value)}
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
            <p className={styles.sortReminder}>Sorted by Start Time</p>

            {orderedEvents.length ? (
              <BoardTable
                events={orderedEvents}
                league={league}
                model={board.model}
                navContext={navigationContext}
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
