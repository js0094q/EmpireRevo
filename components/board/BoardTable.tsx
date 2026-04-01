"use client";

import type { FairEvent } from "@/lib/server/odds/types";
import styles from "./BoardShell.module.css";
import { BoardRow } from "@/components/board/BoardRow";
import {
  eventDetailHref,
  type BoardNavigationContext
} from "@/components/board/board-helpers";

type BoardTableProps = {
  events: FairEvent[];
  league: string;
  model: "sharp" | "equal" | "weighted";
  navContext: BoardNavigationContext;
};

export function BoardTable({ events, league, model, navContext }: BoardTableProps) {
  return (
    <section className={styles.tableWrap}>
      <div className={styles.tableHeader}>
        <div>
          <div className={styles.tableHeadTitle}>Market Pricing Board</div>
          <div className={styles.tableHeadMeta}>Each row compares best available line, fair value, price vs fair, and probability gap.</div>
        </div>
      </div>

      <div className={styles.tableScroller}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Matchup</th>
              <th>Price Snapshot</th>
              <th>Probability Gap</th>
              <th>Open</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <BoardRow
                key={event.id}
                event={event}
                detailHref={eventDetailHref({
                  event,
                  league,
                  market: event.market,
                  model,
                  context: navContext
                })}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
