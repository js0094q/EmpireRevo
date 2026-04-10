import type { BoardRowViewModel } from "@/lib/ui/view-models/boardViewModel";
import { BoardRow } from "@/components/board/BoardRow";
import styles from "./workstation.module.css";

export function BoardTable({ rows }: { rows: BoardRowViewModel[] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Event</th>
            <th>Market</th>
            <th>Best</th>
            <th>Book</th>
            <th>Fair</th>
            <th>Edge</th>
            <th>Confidence</th>
            <th>Books</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <BoardRow key={row.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
