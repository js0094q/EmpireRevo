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
  activeMarkets: FairBoardResponse["activeMarkets"];
  windowKey: Exclude<BoardWindowKey, "all">;
  sortBy: BoardSortKey;
  search: string;
  side: BoardSideKey;
  positiveOnly: boolean;
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
  activeMarkets,
  windowKey,
  sortBy,
  search,
  side,
  positiveOnly,
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
      <div className={styles.toolbarRow}>
        <div className={styles.toolbarLeft}>
          <LeagueSelector value={league} onChange={onLeagueChange} />
          <MarketTabs value={market} onChange={onMarketChange} availableMarkets={activeMarkets} />
        </div>
        <div className={styles.toolbarRight}>
          <SegmentedControl value={windowKey} options={WINDOW_OPTIONS} onChange={onWindowChange} ariaLabel="Time window" />
          <Button onClick={onRefresh}>Refresh</Button>
        </div>
      </div>

      <div className={styles.toolbarRow}>
        <div className={styles.toolbarFilters}>
          <SearchControl value={search} onChange={onSearchChange} className={styles.search} />
          <SortControl value={sortBy} onChange={onSortChange} className={styles.selectCompact} />
          <SegmentedControl value={side} options={SIDE_OPTIONS} onChange={onSideChange} ariaLabel="Side filter" />
        </div>
        <div className={styles.toolbarRight}>
          <Button active={positiveOnly} onClick={onTogglePositive}>
            Value only
          </Button>
        </div>
      </div>
    </section>
  );
}
