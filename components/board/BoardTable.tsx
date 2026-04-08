"use client";

import type { BoardDrilldownRow } from "@/lib/server/odds/types";
import { BoardRow } from "@/components/board/BoardRow";
import styles from "./BoardWorkspace.module.css";

type BoardTableProps = {
  rows: BoardDrilldownRow[];
};

export function BoardTable({ rows }: BoardTableProps) {
  return (
    <section className={styles.tableWrap}>
      <div className={styles.mobileCards}>
        {rows.map((row) => (
          <BoardRow key={`${row.id}:mobile`} row={row} variant="card" />
        ))}
      </div>

      <div className={styles.tableScroller}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Event</th>
              <th>Market</th>
              <th>Best Price</th>
              <th>Fair Line</th>
              <th>Prob Gap</th>
              <th>Value ($ / $100)</th>
              <th>Support</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <BoardRow key={row.id} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
