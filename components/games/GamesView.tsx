"use client";

import { useMemo } from "react";
import type { FairBoardResponse } from "@/lib/server/odds/types";
import { Panel } from "@/components/primitives/Panel";
import { EmptyState } from "@/components/primitives/EmptyState";
import { GamesList } from "@/components/games/GamesList";
import { buildBoardViewModel, buildGamesGroups } from "@/lib/ui/view-models/boardViewModel";
import styles from "@/components/board/workstation.module.css";

export function GamesView({
  board,
  league,
  model
}: {
  board: FairBoardResponse;
  league: string;
  model: "sharp" | "equal" | "weighted";
}) {
  const viewModel = useMemo(
    () =>
      buildBoardViewModel({
        board,
        league,
        model,
        mode: "games",
        filters: {
          search: "",
          sort: "soonest",
          edgeThresholdPct: 0,
          minBooks: 4,
          pinnedOnly: false,
          includeStale: true,
          pinnedBooks: new Set<string>()
        }
      }),
    [board, league, model]
  );
  const groups = useMemo(() => buildGamesGroups(viewModel.rows), [viewModel.rows]);

  return (
    <div className={styles.surface}>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Games</h1>
          <p className={styles.subtitle}>Event directory with direct paths into market detail.</p>
        </div>
        <p className={styles.metaText}>{viewModel.updatedLabel}</p>
      </div>

      <Panel>
        <div className={styles.summaryLine}>
          <strong>{viewModel.rows.length} events</strong>
          <span className={styles.metaText}>Grouped by start window</span>
        </div>
      </Panel>

      {groups.length ? <GamesList groups={groups} /> : <EmptyState title={viewModel.emptyTitle} message={viewModel.emptyMessage} />}
    </div>
  );
}
