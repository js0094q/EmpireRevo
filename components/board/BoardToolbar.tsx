"use client";

import type { FairBoardResponse } from "@/lib/server/odds/types";
import styles from "./BoardShell.module.css";
import { LeagueSelector } from "@/components/board/LeagueSelector";
import { MarketTabs } from "@/components/board/MarketTabs";
import { SearchControl } from "@/components/board/SearchControl";
import { SortControl } from "@/components/board/SortControl";
import type { BoardSideKey, BoardSortKey, BoardWindowKey } from "@/components/board/board-helpers";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const WINDOW_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "next24", label: "Next 24h" }
] as const;

const SIDE_OPTIONS = [
  { value: "all", label: "All sides" },
  { value: "favored", label: "Favored" },
  { value: "underdogs", label: "Underdogs" }
] as const;

type BoardToolbarProps = {
  league: string;
  market: FairBoardResponse["market"];
  marketAvailability: FairBoardResponse["marketAvailability"];
  windowKey: Exclude<BoardWindowKey, "all">;
  sortBy: BoardSortKey;
  search: string;
  side: BoardSideKey;
  positiveEdgeOnly: boolean;
  onLeagueChange: (league: string) => void;
  onMarketChange: (market: FairBoardResponse["market"]) => void;
  onWindowChange: (windowKey: Exclude<BoardWindowKey, "all">) => void;
  onSortChange: (sortBy: BoardSortKey) => void;
  onSearchChange: (search: string) => void;
  onSideChange: (side: BoardSideKey) => void;
  onTogglePositive: () => void;
  onRefresh: () => void;
};

export function BoardToolbar({
  league,
  market,
  marketAvailability,
  windowKey,
  sortBy,
  search,
  side,
  positiveEdgeOnly,
  onLeagueChange,
  onMarketChange,
  onWindowChange,
  onSortChange,
  onSearchChange,
  onSideChange,
  onTogglePositive,
  onRefresh
}: BoardToolbarProps) {
  return (
    <section className={styles.toolbar}>
      <div className={styles.toolbarGroup}>
        <span className={styles.toolbarLabel}>League</span>
        <LeagueSelector value={league} onChange={onLeagueChange} />
      </div>
      <div className={styles.toolbarGroup}>
        <MarketTabs value={market} onChange={onMarketChange} marketAvailability={marketAvailability} />
      </div>
      <div className={styles.toolbarGroup}>
        <span className={styles.toolbarLabel}>Time</span>
        <SegmentedControl value={windowKey} options={WINDOW_OPTIONS} onChange={onWindowChange} ariaLabel="Time window" />
      </div>
      <div className={styles.toolbarGroup}>
        <span className={styles.toolbarLabel}>Sort</span>
        <SortControl value={sortBy} onChange={onSortChange} className={styles.selectCompact} />
      </div>
      <div className={styles.toolbarGroup}>
        <span className={styles.toolbarLabel}>Search</span>
        <SearchControl value={search} onChange={onSearchChange} className={styles.search} />
      </div>
      <div className={styles.toolbarGroup}>
        <span className={styles.toolbarLabel}>Side</span>
        <SegmentedControl value={side} options={SIDE_OPTIONS} onChange={onSideChange} ariaLabel="Side filter" />
      </div>
      <div className={styles.toolbarActions}>
        <Button active={positiveEdgeOnly} onClick={onTogglePositive}>
          Positive Edge
        </Button>
        <Button variant="ghost" onClick={onRefresh}>
          Refresh
        </Button>
      </div>
    </section>
  );
}
