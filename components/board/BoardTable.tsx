"use client";

import dynamic from "next/dynamic";
import { Fragment, useMemo } from "react";
import type { FairEvent } from "@/lib/server/odds/types";
import styles from "./BoardShell.module.css";
import { BoardRow } from "@/components/board/BoardRow";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { BestPriceCell } from "@/components/board/BestPriceCell";
import { FairOddsCell } from "@/components/board/FairOddsCell";
import { EdgeBadge } from "@/components/board/EdgeBadge";
import { ConfidencePill } from "@/components/board/ConfidencePill";
import { MovementPill } from "@/components/board/MovementPill";
import { formatCommenceTime, formatMarketLabel, strongestBook, strongestOutcome } from "@/components/board/board-helpers";
import { Pill } from "@/components/ui/Pill";
import { TeamAvatar } from "@/components/board/TeamAvatar";

const BoardRowExpanded = dynamic(() =>
  import("./BoardRowExpanded").then((mod) => ({
    default: mod.BoardRowExpanded
  }))
);

type BoardTableProps = {
  events: FairEvent[];
  expandedEventId: string | null;
  drawerEventId: string | null;
  league: string;
  model: "sharp" | "equal" | "weighted";
  onToggleExpanded: (eventId: string) => void;
  onOpenDrawer: (eventId: string) => void;
  onCloseDrawer: () => void;
};

export function BoardTable({
  events,
  expandedEventId,
  drawerEventId,
  league,
  model,
  onToggleExpanded,
  onOpenDrawer,
  onCloseDrawer
}: BoardTableProps) {
  const drawerEvent = useMemo(() => events.find((event) => event.id === drawerEventId) ?? null, [drawerEventId, events]);

  return (
    <section className={styles.tableWrap}>
      <div className={styles.tableHeader}>
        <div>
          <div className={styles.tableHeadTitle}>Board</div>
          <div className={styles.tableHeadMeta}>Scan the matchup, compare the live price to fair value, then open the books only when you need detail.</div>
        </div>
      </div>

      <div className={styles.tableScroller}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Matchup</th>
              <th>Top side</th>
              <th>Best line</th>
              <th>Fair price</th>
              <th>Edge</th>
              <th>Market note</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const expanded = expandedEventId === event.id;
              return (
                <Fragment key={event.id}>
                  <BoardRow
                    event={event}
                    expanded={expanded}
                    onToggle={() => onToggleExpanded(event.id)}
                    onOpenDrawer={() => onOpenDrawer(event.id)}
                  />
                  {expanded ? (
                    <tr className={styles.rowExpanded}>
                      <td colSpan={7}>
                        <div className={styles.expandPanel}>
                          <BoardRowExpanded event={event} league={league} model={model} />
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.cards}>
        {events.map((event) => {
          const outcome = strongestOutcome(event);
          const book = strongestBook(outcome);

          return (
            <article key={`card-${event.id}`} className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <div className={styles.matchupTeams}>
                    <TeamAvatar name={event.awayTeam} logoUrl={event.awayLogoUrl} size="sm" showName={false} />
                    <TeamAvatar name={event.homeTeam} logoUrl={event.homeLogoUrl} size="sm" showName={false} />
                  </div>
                  <strong>
                    {event.awayTeam} @ {event.homeTeam}
                  </strong>
                  <div className={styles.mobileCardMeta}>
                    <span className={styles.subtle}>{formatCommenceTime(event.commenceTime)}</span>
                    <Pill tone="accent">{formatMarketLabel(event.market)}</Pill>
                    <Pill>{outcome.name}</Pill>
                  </div>
                </div>
                {book ? <EdgeBadge edgePct={book.edgePct} /> : null}
              </div>

              <div className={styles.cardSignalGrid}>
                <BestPriceCell event={event} outcome={outcome} />
                <FairOddsCell event={event} outcome={outcome} />
              </div>

              <div className={styles.rowPills}>
                <MovementPill outcome={outcome} />
                <ConfidencePill label={event.confidenceLabel} />
              </div>

              <div className={styles.stateActions}>
                <Button onClick={() => onOpenDrawer(event.id)}>View books</Button>
                <Button variant="ghost" onClick={() => onToggleExpanded(event.id)}>
                  {expandedEventId === event.id ? "Hide inline" : "Expand inline"}
                </Button>
              </div>

              {expandedEventId === event.id ? <BoardRowExpanded event={event} league={league} model={model} compact /> : null}
            </article>
          );
        })}
      </div>

      <Drawer open={Boolean(drawerEvent)} onClose={onCloseDrawer}>
        {drawerEvent ? (
          <div className={styles.drawerCard}>
            <div className={styles.drawerHeader}>
              <div>
                <div className={styles.tableHeadTitle}>Books view</div>
                <div className={styles.tableHeadMeta}>
                  {drawerEvent.awayTeam} @ {drawerEvent.homeTeam}
                </div>
              </div>
              <Button onClick={onCloseDrawer}>Close</Button>
            </div>
            <BoardRowExpanded event={drawerEvent} league={league} model={model} compact onClose={onCloseDrawer} />
          </div>
        ) : null}
      </Drawer>
    </section>
  );
}
