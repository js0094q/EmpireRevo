"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TrackOnMount, trackProductEvent } from "@/components/analytics/ProductAnalytics";
import { EmptyState } from "@/components/primitives/EmptyState";
import { Button } from "@/components/primitives/Button";
import { BoardTable } from "@/components/board/BoardTable";
import { BoardToolbar } from "@/components/board/BoardToolbar";
import { getLeagueMarketSupport, supportsAnyProps } from "@/lib/server/odds/marketSupport";
import type { FairBoardResponse, PersistedOutcomeResult } from "@/lib/server/odds/types";
import type { PropsBoardData } from "@/lib/server/odds/propsService";
import { normalizePropType, type PropType } from "@/lib/ui/propsDisplay";
import type { PublicSportOption } from "@/lib/server/odds/sportsRegistry";
import {
  buildBoardViewModel,
  buildPinnedBooksPreferenceLabel,
  type BoardConfidenceFilter,
  type BoardOutcomeFilter,
  type BoardSortValue,
  type BoardSurfaceIntent
} from "@/lib/ui/view-models/boardViewModel";
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
  mode,
  outcomes = [],
  sports = [],
  propsData = null
}: {
  board: FairBoardResponse;
  league: string;
  model: "sharp" | "equal" | "weighted";
  mode: BoardSurfaceIntent;
  outcomes?: PersistedOutcomeResult[];
  sports?: PublicSportOption[];
  propsData?: PropsBoardData | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const storedPreferences = readPreferences();
  const initialMinBooks = Number(searchParams?.get("minBooks") || "4");
  const [search, setSearch] = useState(searchParams?.get("search") || "");
  const [sort, setSort] = useState<BoardSortValue>((searchParams?.get("sort") as BoardSortValue) || "score");
  const [bookKey, setBookKey] = useState(searchParams?.get("book") || "all");
  const [edgeThresholdPct, setEdgeThresholdPct] = useState(Number(searchParams?.get("edgeThresholdPct") || "0"));
  const [confidence, setConfidence] = useState<BoardConfidenceFilter>((searchParams?.get("confidence") as BoardConfidenceFilter) || "all");
  const [outcomeStatus, setOutcomeStatus] = useState<BoardOutcomeFilter>((searchParams?.get("outcome") as BoardOutcomeFilter) || "all");
  const [marketScope, setMarketScope] = useState<"main" | "props">(searchParams?.get("scope") === "props" ? "props" : "main");
  const [propMarketType, setPropMarketType] = useState<PropType>(normalizePropType(searchParams?.get("propType")));
  const [includeStale, setIncludeStale] = useState(searchParams?.get("stale") === "1");
  const [pinnedOnly, setPinnedOnly] = useState(searchParams?.get("pinned") === "1");
  const [beginnerMode, setBeginnerMode] = useState<"beginner" | "advanced">("beginner");
  const [compactMode, setCompactMode] = useState(
    searchParams?.get("compact") ? searchParams.get("compact") !== "0" : (storedPreferences?.compactMode ?? true)
  );
  const [minBooks, setMinBooks] = useState(Number.isFinite(initialMinBooks) ? initialMinBooks : 4);
  const [pinnedBooks, setPinnedBooks] = useState<string[]>(storedPreferences?.pinnedBooks || []);
  const deferredSearch = useDeferredValue(search);
  const leagueSupport = getLeagueMarketSupport(league);
  const leagueSupportsAnyProps = supportsAnyProps(leagueSupport);
  const normalizedPropMarketType: PropType =
    !leagueSupportsAnyProps && marketScope === "props" ? "main" : propMarketType;
  const unsupportedPropsScope = marketScope === "props" && propsData?.unsupported === true;

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
          bookKey,
          edgeThresholdPct,
          confidence,
          outcomeStatus,
          minBooks,
          pinnedOnly,
          includeStale,
          pinnedBooks: new Set(pinnedBooks),
          marketScope,
          propMarketType: normalizedPropMarketType
        },
        outcomes,
        propsData
      }),
    [
      board,
      bookKey,
      confidence,
      deferredSearch,
      edgeThresholdPct,
      includeStale,
      league,
      marketScope,
      minBooks,
      mode,
      model,
      outcomeStatus,
      outcomes,
      pinnedBooks,
      pinnedOnly,
      normalizedPropMarketType,
      propsData,
      sort
    ]
  );

  return (
    <div className={styles.surface}>
      <TrackOnMount
        eventName="board_view"
        properties={{
          league,
          market: board.market,
          model,
          rows: viewModel.rows.length
        }}
      />
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>{viewModel.title}</h1>
          <p className={styles.subtitle}>{viewModel.subtitle}</p>
        </div>
        <div className={styles.headerStats} aria-label="Board status">
          <span>{viewModel.resultLabel}</span>
          <span>{viewModel.coverageLabel}</span>
          <span>{viewModel.updatedLabel}</span>
          <span>{includeStale ? "Stale included" : "Fresh only"}</span>
          <span>{compactMode ? "Compact" : "Comfortable"}</span>
        </div>
      </div>

      <div className={styles.healthStrip} aria-label="Market health">
        {[
          ...(sports.length ? [{ label: "Sports", value: `${sports.length}` }] : []),
          ...viewModel.statusItems
        ].map((item) => (
          <span key={`${item.label}-${item.value}`} className={item.tone ? styles[`health_${item.tone}`] : undefined}>
            <small>{item.label}</small>
            <strong>{item.value}</strong>
          </span>
        ))}
      </div>

      <BoardToolbar
        value={{
          league,
          market: board.market,
          model,
          minBooks,
          bookKey,
          search,
          sort,
          edgeThresholdPct,
          confidence,
          outcomeStatus,
          includeStale,
          pinnedOnly,
          compactMode,
          pinnedBooks,
          marketScope,
          propMarketType: normalizedPropMarketType
        }}
        books={viewModel.books}
        sports={sports}
        preferencesLabel={buildPinnedBooksPreferenceLabel(board, new Set(pinnedBooks))}
        onChange={(next) => {
          if (next.league !== undefined) {
            updateParams({ league: next.league });
            trackProductEvent("filter_change", { filter: "sport", value: next.league, league: next.league, market: board.market });
          }
          if (next.market !== undefined) {
            updateParams({ market: next.market });
            trackProductEvent("filter_change", { filter: "market", value: next.market, league, market: next.market });
          }
          if (next.marketScope !== undefined) {
            setMarketScope(next.marketScope);
            updateParams({ scope: next.marketScope === "props" ? "props" : null });
            trackProductEvent("filter_change", { filter: "market_scope", value: next.marketScope, league, market: board.market });
          }
          if (next.propMarketType !== undefined) {
            const safePropType = marketScope === "props" && !leagueSupportsAnyProps ? "main" : next.propMarketType;
            setPropMarketType(safePropType);
            updateParams({ propType: safePropType === "main" ? null : safePropType });
            trackProductEvent("filter_change", { filter: "prop_market_type", value: safePropType, league, market: board.market });
          }
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
            trackProductEvent("sort_change", { sort: next.sort, league, market: board.market });
          }
          if (next.bookKey !== undefined) {
            setBookKey(next.bookKey);
            updateParams({ book: next.bookKey === "all" ? null : next.bookKey });
            trackProductEvent("filter_change", { filter: "book", value: next.bookKey, league, market: board.market });
          }
          if (next.edgeThresholdPct !== undefined) {
            setEdgeThresholdPct(next.edgeThresholdPct);
            updateParams({ edgeThresholdPct: next.edgeThresholdPct > 0 ? `${next.edgeThresholdPct}` : null });
            trackProductEvent("filter_change", { filter: "ev_threshold", value: next.edgeThresholdPct, league, market: board.market });
          }
          if (next.confidence !== undefined) {
            setConfidence(next.confidence);
            updateParams({ confidence: next.confidence === "all" ? null : next.confidence });
            trackProductEvent("filter_change", { filter: "confidence", value: next.confidence, league, market: board.market });
          }
          if (next.outcomeStatus !== undefined) {
            setOutcomeStatus(next.outcomeStatus);
            updateParams({ outcome: next.outcomeStatus === "all" ? null : next.outcomeStatus });
            trackProductEvent("filter_change", { filter: "outcome", value: next.outcomeStatus, league, market: board.market });
          }
          if (next.includeStale !== undefined) {
            setIncludeStale(next.includeStale);
            updateParams({ stale: next.includeStale ? "1" : null });
            trackProductEvent("filter_change", { filter: "freshness", value: next.includeStale ? "include_stale" : "fresh_only", league, market: board.market });
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
        onRefresh={() => {
          trackProductEvent("odds_refresh", { league, market: board.market, model });
          router.refresh();
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
        experienceMode={beginnerMode}
        onModeChange={(nextMode) => setBeginnerMode(nextMode)}
        supportsAnyProps={leagueSupportsAnyProps}
        propsDisabledReason={leagueSupport.disabledReason}
      />

      {viewModel.rows.length ? (
        <BoardTable rows={viewModel.rows} compactMode={compactMode} />
      ) : (
        <EmptyState
          title={viewModel.emptyTitle}
          message={viewModel.emptyMessage}
          actions={
            unsupportedPropsScope ? (
              <Button
                type="button"
                onClick={() => {
                  setMarketScope("main");
                  setPropMarketType("main");
                  updateParams({ scope: null, propType: null });
                  trackProductEvent("filter_change", {
                    filter: "market_scope",
                    value: "main",
                    league,
                    market: board.market,
                    reason: "unsupported_props"
                  });
                }}
              >
                Switch to Main Lines
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
