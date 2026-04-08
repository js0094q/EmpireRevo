"use client";

import { startTransition, useDeferredValue, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FairBoardResponse } from "@/lib/server/odds/types";
import { AppContainer } from "@/components/layout/AppContainer";
import { BrandMark } from "@/components/layout/BrandMark";
import { BoardTable } from "@/components/board/BoardTable";
import { EmptyState } from "@/components/board/EmptyState";
import { LeagueSelector } from "@/components/board/LeagueSelector";
import { MarketTabs } from "@/components/board/MarketTabs";
import { SearchControl } from "@/components/board/SearchControl";
import styles from "./BoardWorkspace.module.css";

type BoardShellProps = {
  board: FairBoardResponse;
  league: string;
};

type BoardSort = "value" | "soonest" | "fair" | "consensus";

function parseSort(value: string | null): BoardSort {
  if (value === "soonest" || value === "fair" || value === "consensus") return value;
  return "value";
}

function marketLabel(market: FairBoardResponse["market"]): string {
  if (market === "spreads") return "Spread";
  if (market === "totals") return "Total";
  return "Moneyline";
}

function formatSigned(value: number): string {
  if (!Number.isFinite(value)) return "--";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
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
      ? rows.filter(
          (row) =>
            row.event.toLowerCase().includes(query) ||
            row.market.toLowerCase().includes(query) ||
            row.bestBook.toLowerCase().includes(query)
        )
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
    const averageConsensus = rows.length
      ? rows.reduce((sum, row) => sum + row.booksInConsensus, 0) / rows.length
      : 0;

    return {
      opportunities: rows.length,
      positiveRows,
      liveRows,
      strongestValue: Number.isFinite(strongestValue) ? strongestValue : 0,
      averageConsensus,
      booksTracked: board.books.length
    };
  }, [board.books.length, rows]);

  return (
    <AppContainer>
      <div className={styles.page}>
        <header className={styles.hero}>
          <div className={styles.heroMain}>
            <div className={styles.brandRow}>
              <BrandMark className={styles.heroBrandMark} />
              <div className={styles.titleBlock}>
                <h1 className={styles.title}>EmpirePicks Market Board</h1>
                <p className={styles.subtitle}>Scan best listed price vs fair line and probability gap across comparable books.</p>
              </div>
            </div>
            <p className={styles.methodology}>
              Fair line is built by removing vig within each market group, then applying model weighting before EV calculation.
            </p>
          </div>
          <div className={styles.heroMeta}>
            <span className={styles.statusPill}>{marketLabel(board.market)}</span>
            <span className={styles.timestamp}>{board.lastUpdatedLabel}</span>
          </div>
        </header>

        <section className={styles.toolbar}>
          <div className={styles.controlCluster}>
            <div className={styles.controlBlock}>
              <span className={styles.controlLabel}>League</span>
              <LeagueSelector value={league} onChange={(value) => replaceParam("league", value)} />
            </div>
            <div className={styles.controlBlock}>
              <span className={styles.controlLabel}>Market</span>
              <MarketTabs
                value={board.market}
                onChange={(value) => replaceParam("market", value)}
                marketAvailability={board.marketAvailability}
              />
            </div>
          </div>
          <div className={styles.searchBlock}>
            <span className={styles.controlLabel}>Search</span>
            <SearchControl value={search} onChange={setSearch} className={styles.search} />
          </div>
          <label className={styles.sortBlock}>
            <span className={styles.controlLabel}>Sort</span>
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
              <option value="fair">Fair Line</option>
              <option value="consensus">Consensus Depth</option>
            </select>
          </label>
        </section>

        <section className={styles.kpiStrip} aria-label="Board summary">
          <article className={styles.kpi}>
            <span className={styles.kpiLabel}>Opportunities</span>
            <strong className={styles.kpiValue}>{summary.opportunities}</strong>
          </article>
          <article className={styles.kpi}>
            <span className={styles.kpiLabel}>Positive EV Rows</span>
            <strong className={styles.kpiValue}>{summary.positiveRows}</strong>
          </article>
          <article className={styles.kpi}>
            <span className={styles.kpiLabel}>Live Rows</span>
            <strong className={styles.kpiValue}>{summary.liveRows}</strong>
          </article>
          <article className={styles.kpi}>
            <span className={styles.kpiLabel}>Strongest Value</span>
            <strong className={styles.kpiValue}>{formatSigned(summary.strongestValue)}</strong>
          </article>
          <article className={styles.kpi}>
            <span className={styles.kpiLabel}>Avg Consensus</span>
            <strong className={styles.kpiValue}>{summary.averageConsensus.toFixed(1)} books</strong>
          </article>
          <article className={styles.kpi}>
            <span className={styles.kpiLabel}>Books Tracked</span>
            <strong className={styles.kpiValue}>{summary.booksTracked}</strong>
          </article>
        </section>

        <section className={styles.boardSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Best Price vs Fair Line</h2>
            <p className={styles.sectionMeta}>{filteredRows.length} rows shown</p>
          </div>

          {filteredRows.length ? (
            <BoardTable rows={filteredRows} />
          ) : (
            <EmptyState
              title="No markets match this view"
              message="Try another league, market, or search term."
              actionLabel="Refresh"
              onAction={() => router.refresh()}
            />
          )}
        </section>
      </div>
    </AppContainer>
  );
}
