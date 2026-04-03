"use client";

import { startTransition, useDeferredValue, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FairBoardResponse } from "@/lib/server/odds/types";
import { AppContainer } from "@/components/layout/AppContainer";
import { BrandMark } from "@/components/layout/BrandMark";
import styles from "./BoardShell.module.css";
import { BoardTable } from "@/components/board/BoardTable";
import { EmptyState } from "@/components/board/EmptyState";
import { LeagueSelector } from "@/components/board/LeagueSelector";
import { MarketTabs } from "@/components/board/MarketTabs";
import { SearchControl } from "@/components/board/SearchControl";

type BoardShellProps = {
  board: FairBoardResponse;
  league: string;
};

type BoardSort = "value" | "soonest" | "fair" | "consensus";

function parseSort(value: string | null): BoardSort {
  if (value === "soonest" || value === "fair" || value === "consensus") return value;
  return "value";
}

export function BoardShell({ board, league }: BoardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState((searchParams?.get("search") || "").trim());
  const [sortBy, setSortBy] = useState<BoardSort>(parseSort(searchParams?.get("sort")));
  const deferredSearch = useDeferredValue(search);
  const rows = useMemo(() => board.boardRows ?? [], [board.boardRows]);

  function replaceParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set(key, value);
    const path = pathname?.startsWith("/games") ? "/games" : "/";
    startTransition(() => {
      router.replace(`${path}?${params.toString()}`);
    });
  }

  const filteredRows = useMemo(() => {
    const query = deferredSearch.toLowerCase();
    const base = query
      ? rows.filter((row) => row.event.toLowerCase().includes(query) || row.market.toLowerCase().includes(query) || row.bestBook.toLowerCase().includes(query))
      : rows;

    const sorted = [...base];
    sorted.sort((a, b) => {
      if (sortBy === "soonest") {
        return Date.parse(a.commenceTime) - Date.parse(b.commenceTime) || b.valuePer100 - a.valuePer100;
      }
      if (sortBy === "fair") {
        return b.marketFairOdds - a.marketFairOdds || b.valuePer100 - a.valuePer100;
      }
      if (sortBy === "consensus") {
        return b.booksInConsensus - a.booksInConsensus || b.valuePer100 - a.valuePer100;
      }
      return b.valuePer100 - a.valuePer100 || Date.parse(a.commenceTime) - Date.parse(b.commenceTime);
    });
    return sorted;
  }, [deferredSearch, rows, sortBy]);

  return (
    <AppContainer>
      <div className={styles.page}>
        <section className={styles.simpleHeader}>
          <div className={styles.brandBlock}>
            <BrandMark className={styles.heroBrandMark} />
            <div>
              <h1 className={styles.heroTitle}>EmpirePicks Board</h1>
              <p className={styles.heroSubhead}>Compare the best offered line against weighted fair odds, then size by value per $100.</p>
            </div>
          </div>
          <div className={styles.controlRow}>
            <LeagueSelector value={league} onChange={(value) => replaceParam("league", value)} />
            <MarketTabs value={board.market} onChange={(value) => replaceParam("market", value)} marketAvailability={board.marketAvailability} />
            <SearchControl value={search} onChange={setSearch} className={styles.search} />
            <label className={styles.sortLabel}>
              Sort
              <select
                value={sortBy}
                onChange={(event) => {
                  const next = parseSort(event.target.value);
                  setSortBy(next);
                  replaceParam("sort", next);
                }}
                className={styles.sortSelect}
              >
                <option value="value">Value ($ / $100)</option>
                <option value="soonest">Start Time</option>
                <option value="fair">Market Fair Odds</option>
                <option value="consensus">Books in Consensus</option>
              </select>
            </label>
          </div>
          <div className={styles.glossaryRow}>
            <p>
              <strong>Fair Odds:</strong> Consensus no-vig price from weighted books.
            </p>
            <p>
              <strong>Best Price:</strong> Highest payout currently offered for the same side and line.
            </p>
            <p>
              <strong>Value:</strong> Estimated profit per $100 stake if fair odds are correct.
            </p>
          </div>
          <p className={styles.primerExample}>Example: best +110 vs fair +102 projects +3.4 per $100. EV can be suppressed when coverage is thin.</p>
        </section>

        {filteredRows.length ? (
          <BoardTable rows={filteredRows} />
        ) : (
          <EmptyState
            title="No markets match this view"
            message="Try a different league, market, or search."
            actionLabel="Refresh"
            onAction={() => router.refresh()}
          />
        )}
      </div>
    </AppContainer>
  );
}
