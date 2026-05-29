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

      <div className={styles.mobileCards} aria-label="Market board cards">
        {rows.map((row) => (
          <Link key={`${row.id}-mobile`} href={row.href} className={styles.mobileCard}>
            <span className={styles.mobileCardHeader}>
              <span>
                <strong>{row.event}</strong>
                <span className={styles.eventMeta}>{row.eventMeta}</span>
              </span>
              <span className={styles.mobileStatus}>{row.isActionable ? "Actionable" : row.marketStatus}</span>
            </span>
            <span className={styles.mobileMarket}>{row.market}</span>
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
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
