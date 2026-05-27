import type { BoardRowViewModel } from "@/lib/ui/view-models/boardViewModel";
import { BoardRow } from "@/components/board/BoardRow";
import styles from "./workstation.module.css";

export function BoardTable({ rows, compactMode }: { rows: BoardRowViewModel[]; compactMode: boolean }) {
  return (
    <div className={styles.tableWrap}>
      <table className={`${styles.table} ${compactMode ? styles.tableCompact : styles.tableComfortable}`} aria-label="Market board">
        <thead>
          <tr>
            <th scope="col" className={styles.stickyEvent} title="Sort and compare events to see ranked opportunities.">
              Event
            </th>
            <th scope="col" className={styles.stickyMarket} title="Market outcome currently being ranked for this event.">
              Market
            </th>
            <th scope="col" title="Best posted line across all supported books versus fair price.">
              Best line
            </th>
            <th scope="col" title="Books that posted the best actionable line.">Book</th>
            <th scope="col" title="No-vig consensus probability converted to fair American odds.">Fair line</th>
            <th scope="col" title="Gap between posted odds and fair odds (positive is a larger edge)">
              Gap
            </th>
            <th scope="col" title="Opportunity versus projected edge from the selected model.">
              Opportunity
            </th>
            <th scope="col" title="Best/booked movement versus fair value for this market.">Signal</th>
            <th scope="col" title="How stable this recommendation signal is across books and freshness.">Confidence</th>
            <th scope="col" className={styles.hideOnMobile} title="Books contributing to this recommendation.">
              Coverage
            </th>
            <th scope="col">Movement</th>
            <th scope="col" className={styles.hideOnMobile} title="How recently this opportunity was updated.">
              Updated
            </th>
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
