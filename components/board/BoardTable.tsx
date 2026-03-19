"use client";

import dynamic from "next/dynamic";
import { Fragment, useMemo } from "react";
import type { FairEvent } from "@/lib/server/odds/types";
import styles from "./BoardShell.module.css";
import { BoardRow } from "@/components/board/BoardRow";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { bestPriceBook, formatCommenceTime, formatMarketLabel, formatOffer, strongestBook, strongestOutcome } from "@/components/board/board-helpers";
import { TeamAvatar } from "@/components/board/TeamAvatar";
import { cn } from "@/lib/ui/cn";

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
          <div className={styles.tableHeadMeta}>Matchups, prices, fair value, and edge in one view.</div>
        </div>
      </div>

      <div className={styles.tableScroller}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Matchup</th>
              <th>Board</th>
              <th>Edge</th>
              <th>Details</th>
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
                      <td colSpan={4}>
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
          const bestLineBook = bestPriceBook(outcome);
          const edgePct = book?.edgePct ?? 0;

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
                  <div className={styles.metaText}>{formatCommenceTime(event.commenceTime)}</div>
                </div>
                <p
                  className={cn(
                    styles.edgePrimary,
                    edgePct < 0 ? styles.edgePrimaryNegative : edgePct >= 1.5 ? styles.edgePrimaryStrong : edgePct >= 0.75 ? styles.edgePrimaryModerate : styles.edgePrimaryMuted
                  )}
                >
                  {`${edgePct > 0 ? "+" : ""}${edgePct.toFixed(2)}%`}
                </p>
              </div>

              <p className={styles.mobileDirective}>{book && book.edgePct < 0 ? `Market Mispricing: ${outcome.name} Overpriced` : `Best Bet: ${outcome.name}`}</p>

              <div className={styles.opportunityPrimary}>
                <strong>{outcome.name}</strong>
                <span className={styles.cellValue}>{bestLineBook ? formatOffer(event.market, bestLineBook) : "--"}</span>
                <span className={styles.metaText}>{bestLineBook ? bestLineBook.title : "No Live Book"}</span>
              </div>
              <p className={styles.metaText}>{formatMarketLabel(event.market)}</p>
              <p className={styles.metaText}>{`Fair: ${formatOffer(event.market, outcome)}`}</p>

              <div className={styles.stateActions}>
                <Button onClick={() => onOpenDrawer(event.id)}>View Books</Button>
                <Button variant="ghost" onClick={() => onToggleExpanded(event.id)}>
                  {expandedEventId === event.id ? "Hide Details" : "Show Details"}
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
                <div className={styles.tableHeadTitle}>Book Table</div>
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
