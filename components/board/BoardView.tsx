"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/primitives/EmptyState";
import { Panel } from "@/components/primitives/Panel";
import { BoardTable } from "@/components/board/BoardTable";
import { BoardToolbar } from "@/components/board/BoardToolbar";
import type { FairBoardResponse } from "@/lib/server/odds/types";
import { buildBoardViewModel, buildPinnedBooksPreferenceLabel, type BoardSortValue, type BoardSurfaceIntent } from "@/lib/ui/view-models/boardViewModel";
import styles from "./workstation.module.css";

const PREF_KEY = "empirepicks:preferences";

type Preferences = {
  defaultLeague: string;
  defaultModel: "sharp" | "equal" | "weighted";
  defaultMinBooks: number;
  compactMode: boolean;
  pinnedBooks: string[];
};

function readPreferences(): Preferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PREF_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Preferences;
  } catch {
    return null;
  }
}

function writePreferences(preferences: Preferences) {
  window.localStorage.setItem(PREF_KEY, JSON.stringify(preferences));
}

export function BoardView({
  board,
  league,
  model,
  mode
}: {
  board: FairBoardResponse;
  league: string;
  model: "sharp" | "equal" | "weighted";
  mode: BoardSurfaceIntent;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const storedPreferences = readPreferences();
  const initialMinBooks = Number(searchParams?.get("minBooks") || "4");
  const [search, setSearch] = useState(searchParams?.get("search") || "");
  const [sort, setSort] = useState<BoardSortValue>((searchParams?.get("sort") as BoardSortValue) || "score");
  const [edgeThresholdPct, setEdgeThresholdPct] = useState(Number(searchParams?.get("edgeThresholdPct") || "0"));
  const [includeStale, setIncludeStale] = useState(searchParams?.get("stale") === "1");
  const [pinnedOnly, setPinnedOnly] = useState(searchParams?.get("pinned") === "1");
  const [compactMode, setCompactMode] = useState(
    searchParams?.get("compact") ? searchParams.get("compact") !== "0" : (storedPreferences?.compactMode ?? true)
  );
  const [minBooks, setMinBooks] = useState(Number.isFinite(initialMinBooks) ? initialMinBooks : 4);
  const [pinnedBooks, setPinnedBooks] = useState<string[]>(storedPreferences?.pinnedBooks || []);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    const preferences = storedPreferences;
    if (!preferences) return;
    const params = new URLSearchParams(searchParams?.toString() || "");
    let dirty = false;
    if (!params.get("league") && preferences.defaultLeague) {
      params.set("league", preferences.defaultLeague);
      dirty = true;
    }
    if (!params.get("model") && preferences.defaultModel) {
      params.set("model", preferences.defaultModel);
      dirty = true;
    }
    if (!params.get("minBooks") && preferences.defaultMinBooks) {
      params.set("minBooks", `${preferences.defaultMinBooks}`);
      dirty = true;
    }
    if (!params.get("compact")) {
      params.set("compact", preferences.compactMode ? "1" : "0");
      dirty = true;
    }
    if (dirty) {
      startTransition(() => router.replace(`${pathname}?${params.toString()}`));
    }
  }, [pathname, router, searchParams, storedPreferences]);

  function updateParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams?.toString() || "");
    Object.entries(next).forEach(([key, value]) => {
      if (!value) params.delete(key);
      else params.set(key, value);
    });
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  const viewModel = useMemo(
    () =>
      buildBoardViewModel({
        board,
        league,
        model,
        mode,
        filters: {
          search: deferredSearch,
          sort,
          edgeThresholdPct,
          minBooks,
          pinnedOnly,
          includeStale,
          pinnedBooks: new Set(pinnedBooks)
        }
      }),
    [board, deferredSearch, edgeThresholdPct, includeStale, league, minBooks, mode, model, pinnedBooks, pinnedOnly, sort]
  );

  return (
    <div className={styles.surface}>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>{viewModel.title}</h1>
          <p className={styles.subtitle}>{viewModel.subtitle}</p>
        </div>
        <p className={styles.metaText}>{viewModel.updatedLabel}</p>
      </div>

      <BoardToolbar
        value={{
          league,
          market: board.market,
          model,
          minBooks,
          search,
          sort,
          edgeThresholdPct,
          includeStale,
          pinnedOnly,
          compactMode,
          pinnedBooks
        }}
        books={viewModel.books}
        preferencesLabel={buildPinnedBooksPreferenceLabel(board, new Set(pinnedBooks))}
        onChange={(next) => {
          if (next.league !== undefined) updateParams({ league: next.league });
          if (next.market !== undefined) updateParams({ market: next.market });
          if (next.model !== undefined) updateParams({ model: next.model });
          if (next.minBooks !== undefined) {
            setMinBooks(next.minBooks);
            updateParams({ minBooks: `${next.minBooks}` });
          }
          if (next.search !== undefined) {
            setSearch(next.search);
            updateParams({ search: next.search || null });
          }
          if (next.sort !== undefined) {
            setSort(next.sort);
            updateParams({ sort: next.sort });
          }
          if (next.edgeThresholdPct !== undefined) {
            setEdgeThresholdPct(next.edgeThresholdPct);
            updateParams({ edgeThresholdPct: next.edgeThresholdPct > 0 ? `${next.edgeThresholdPct}` : null });
          }
          if (next.includeStale !== undefined) {
            setIncludeStale(next.includeStale);
            updateParams({ stale: next.includeStale ? "1" : null });
          }
          if (next.pinnedOnly !== undefined) {
            setPinnedOnly(next.pinnedOnly);
            updateParams({ pinned: next.pinnedOnly ? "1" : null });
          }
          if (next.compactMode !== undefined) {
            setCompactMode(next.compactMode);
            updateParams({ compact: next.compactMode ? "1" : "0" });
          }
          if (next.pinnedBooks !== undefined) {
            setPinnedBooks(next.pinnedBooks);
          }
        }}
        onSaveDefaults={() =>
          writePreferences({
            defaultLeague: league,
            defaultModel: model,
            defaultMinBooks: minBooks,
            compactMode,
            pinnedBooks
          })
        }
      />

      <Panel>
        <div className={styles.summaryLine}>
          <strong>{viewModel.rows.length} markets</strong>
          <span className={styles.metaText}>{compactMode ? "Compact mode" : "Comfortable mode"}</span>
        </div>
      </Panel>

      {viewModel.rows.length ? (
        <BoardTable rows={viewModel.rows} />
      ) : (
        <EmptyState title={viewModel.emptyTitle} message={viewModel.emptyMessage} />
      )}
    </div>
  );
}
