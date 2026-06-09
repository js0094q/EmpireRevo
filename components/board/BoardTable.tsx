import Link from "next/link";
import type { BoardRowViewModel } from "@/lib/ui/view-models/boardViewModel";
import { BoardRow } from "@/components/board/BoardRow";
import styles from "./workstation.module.css";

export function BoardTable({ rows, compactMode }: { rows: BoardRowViewModel[]; compactMode: boolean }) {
  return (
    <>
      <div className={styles.tableWrap}>
        <table className={`${styles.table} ${compactMode ? styles.tableCompact : styles.tableComfortable}`} aria-label="Market board">
          <thead>
            <tr>
              <th scope="col" className={styles.stickyEvent} title="Sort and compare events to see ranked opportunities.">
                Game
              </th>
              <th scope="col" className={styles.stickyMarket} title="Market type currently being ranked for this event.">
                Market
              </th>
              <th scope="col" title="Team or side being evaluated.">
                Selection
              </th>
              <th scope="col" title="Book posting the best available price.">
                Best Book
              </th>
              <th scope="col" title="Best posted line across all supported books.">
                Best Price
              </th>
              <th scope="col" title="No-vig consensus probability converted to fair American odds.">Fair Price</th>
              <th scope="col" title="Expected value versus the fair price.">EV %</th>
              <th scope="col" title="How stable this recommendation signal is across books and freshness.">Confidence</th>
              <th scope="col" className={styles.hideOnMobile} title="How recently this opportunity was updated.">
                Freshness
              </th>
              <th scope="col" className={styles.hideOnMobile} title="Whether the best price is available at pinned books.">
                Pinned
              </th>
              <th scope="col" title="Settlement state for the tracked opportunity.">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <BoardRow key={row.id} row={row} expandByDefault={index === 0} />
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.mobileCards} aria-label="Market board cards">
        {rows.map((row) => (
          <Link key={`${row.id}-mobile`} href={row.href} className={styles.mobileCard}>
            <span className={styles.mobileCardHeader}>
              <span>
                <strong>{row.event}</strong>
                <span className={styles.eventMeta}>{row.eventMeta}</span>
              </span>
              <span className={styles.mobileStatus}>{row.isStale ? "Stale" : row.isActionable ? "Actionable" : row.marketStatus}</span>
            </span>
            <span className={styles.mobileMarket}>{row.market}</span>
            <span className={styles.eventMeta}>{row.selection}</span>
            <span className={styles.mobileMetricGrid}>
              <span>
                <span className={styles.mobileMetricLabel}>Best</span>
                <strong>{row.bestPrice}</strong>
                <span className={styles.eventMeta}>{row.bestBook}</span>
              </span>
              <span>
                <span className={styles.mobileMetricLabel}>Fair</span>
                <strong>{row.fairPrice}</strong>
                <span className={styles.eventMeta}>{row.fairPriceMeta}</span>
              </span>
              <span>
                <span className={styles.mobileMetricLabel}>EV</span>
                <strong>{row.ev}</strong>
                <span className={styles.eventMeta}>{row.evMeta || "Market aligned"}</span>
              </span>
              <span>
                <span className={styles.mobileMetricLabel}>Confidence</span>
                <strong>{row.confidence}</strong>
                <span className={styles.eventMeta}>{row.updated}</span>
              </span>
              <span>
                <span className={styles.mobileMetricLabel}>Pinned</span>
                <strong>{row.pinnedAvailability}</strong>
                <span className={styles.eventMeta}>{row.bestPinnedPrice ? `Pinned ${row.bestPinnedPrice}` : "No pinned edge"}</span>
              </span>
              <span>
                <span className={styles.mobileMetricLabel}>Outcome</span>
                <strong>{row.outcomeLabel}</strong>
                <span className={styles.eventMeta}>{row.marketStatus}</span>
              </span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
