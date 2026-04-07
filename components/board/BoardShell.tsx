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

  const summary = useMemo(() => {
    const positiveRows = rows.filter((row) => row.valuePer100 > 0).length;
    const liveRows = rows.filter((row) => row.isLive).length;
    const strongestValue = rows.reduce((max, row) => Math.max(max, row.valuePer100), Number.NEGATIVE_INFINITY);

    return {
      matchups: rows.length,
      positiveRows,
      liveRows,
      booksTracked: board.books.length,
      strongestValue: Number.isFinite(strongestValue) ? strongestValue : 0
    };
  }, [board.books.length, rows]);

  return (
    <AppContainer>
      <div className={styles.page}>
        <section className={styles.simpleHeader}>
          <div className={styles.headerTop}>
            <div className={styles.brandBlock}>
              <BrandMark className={styles.heroBrandMark} />
              <div>
                <h1 className={styles.heroTitle}>EmpirePicks Live Board</h1>
                <p className={styles.heroSubhead}>Line shopping against weighted fair odds, tuned for fast scanning instead of badge spam.</p>
              </div>
            </div>
            <div className={styles.headerMeta}>
              <span className={styles.marketTag}>{board.market === "h2h" ? "Moneyline" : board.market === "spreads" ? "Spread" : "Total"}</span>
              <span className={styles.updatedStamp}>{board.lastUpdatedLabel}</span>
            </div>
          </div>

          <div className={styles.summaryStrip}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Matchups</span>
              <strong className={styles.summaryValue}>{summary.matchups}</strong>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Positive Value</span>
              <strong className={styles.summaryValue}>{summary.positiveRows}</strong>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Live Now</span>
              <strong className={styles.summaryValue}>{summary.liveRows}</strong>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Strongest Value</span>
              <strong className={styles.summaryValue}>
                {summary.strongestValue > 0 ? "+" : ""}
                {summary.strongestValue.toFixed(2)}
              </strong>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>Books Tracked</span>
              <strong className={styles.summaryValue}>{summary.booksTracked}</strong>
            </div>
          </div>

          <p className={styles.headerNote}>
            Scan the board in this order: best listed price, model fair line, probability gap, then value per $100. Confidence and book count tell you how much market support is behind the number.
          </p>

          <div className={styles.controlRow}>
            <LeagueSelector value={league} onChange={(value) => replaceParam("league", value)} />
            <MarketTabs value={board.market} onChange={(value) => replaceParam("market", value)} marketAvailability={board.marketAvailability} />
            <SearchControl value={search} onChange={setSearch} className={styles.search} />
            <label className={styles.sortLabel}>
              Sort Board
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
              <strong>Best Price</strong>
              Highest payout currently on the board for the exact side and line.
            </p>
            <p>
              <strong>Fair Line</strong>
              No-vig consensus price aggregated across weighted books in the same market group.
            </p>
            <p>
              <strong>Probability Gap</strong>
              Model fair probability minus the break-even rate implied by the offered price.
            </p>
          </div>
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
