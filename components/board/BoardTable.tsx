import type { BoardRowViewModel } from "@/lib/ui/view-models/boardViewModel";
import { BoardRow } from "@/components/board/BoardRow";
import styles from "./workstation.module.css";

export function BoardTable({ rows, compactMode }: { rows: BoardRowViewModel[]; compactMode: boolean }) {
  return (
    <div className={styles.tableWrap}>
      <table className={`${styles.table} ${compactMode ? styles.tableCompact : styles.tableComfortable}`} aria-label="Market board">
        <thead>
          <tr>
            <th scope="col">Event</th>
            <th scope="col">Market</th>
            <th scope="col">Best price</th>
            <th scope="col">Book</th>
            <th scope="col">Fair odds</th>
            <th scope="col">Price vs fair</th>
            <th scope="col">Prob gap</th>
            <th scope="col">EV</th>
            <th scope="col">Confidence</th>
            <th scope="col">Coverage</th>
            <th scope="col">Start</th>
            <th scope="col">Updated</th>
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
