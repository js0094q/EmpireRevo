import Link from "next/link";
import { Badge } from "@/components/primitives/Badge";
import type { BoardRowViewModel } from "@/lib/ui/view-models/boardViewModel";
import styles from "@/components/board/workstation.module.css";

export function GameSummaryRow({ row }: { row: BoardRowViewModel }) {
  return (
    <article className={styles.gameCard}>
      <div className={styles.gameCardTop}>
        <div className={styles.eventCell}>
          <Link href={row.href} className={styles.rowLink}>
            <span className={styles.eventName}>{row.event}</span>
          </Link>
          <span className={styles.eventMeta}>{row.eventMeta}</span>
        </div>
        <div className={styles.mutedBadgeRow}>
          <Badge tone={row.isActionable ? "positive" : "neutral"}>{row.isActionable ? "Actionable" : row.marketStatus}</Badge>
          {row.staleLabel ? <Badge tone="warning">{row.staleLabel}</Badge> : null}
        </div>
      </div>

      <div className={styles.gameCardMetrics}>
        <div className={styles.gameMetric}>
          <span className={styles.gameMetricLabel}>Market</span>
          <strong>{row.market}</strong>
        </div>
        <div className={styles.gameMetric}>
          <span className={styles.gameMetricLabel}>Best</span>
          <strong>{row.bestPrice}</strong>
        </div>
        <div className={styles.gameMetric}>
          <span className={styles.gameMetricLabel}>Fair</span>
          <strong>{row.fairPrice}</strong>
        </div>
        <div className={styles.gameMetric}>
          <span className={styles.gameMetricLabel}>Edge</span>
          <strong>{row.edge}</strong>
        </div>
        <div className={styles.gameMetric}>
          <span className={styles.gameMetricLabel}>Confidence</span>
          <strong>{row.confidence}</strong>
        </div>
      </div>

      <div className={styles.gameCardBottom}>
        <span className={styles.metaText}>{row.bestBook}</span>
        <span className={styles.metaText}>{row.updated}</span>
      </div>
    </article>
  );
}
