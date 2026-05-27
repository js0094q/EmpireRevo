import Link from "next/link";
import { BestLineCell } from "@/components/board/BestLineCell";
import { BooksCell } from "@/components/board/BooksCell";
import { ConfidenceBadge } from "@/components/board/ConfidenceBadge";
import { EdgeCell } from "@/components/board/EdgeCell";
import { FairCell } from "@/components/board/FairCell";
import { FreshnessCell } from "@/components/board/FreshnessCell";
import type { BoardRowViewModel } from "@/lib/ui/view-models/boardViewModel";
import styles from "./workstation.module.css";

export function BoardRow({ row }: { row: BoardRowViewModel }) {
  const probabilityGapTone = row.probabilityGapValue >= 1 ? "positive" : "neutral";

  return (
    <tr className={[styles.row, row.isActionable ? styles.rowActionable : "", row.isStale ? styles.rowStale : ""].join(" ")}>
      <td className={styles.stickyEvent}>
        <div className={styles.eventCell}>
          <Link href={row.href} className={styles.rowLink} title={`Open ${row.event} market detail`}>
            <span className={styles.eventName}>{row.event}</span>
          </Link>
          <span className={styles.eventMeta}>{row.eventMeta}</span>
        </div>
      </td>
      <td className={styles.stickyMarket}>
        <div className={styles.marketCell}>
          <span title={row.marketMeta}>{row.market}</span>
          <span className={styles.cellMeta}>{row.marketMeta}</span>
        </div>
      </td>
      <td>
        <BestLineCell bestPrice={row.bestPrice} meta={row.bestPriceMeta} pinnedPrice={row.bestPinnedPrice} />
      </td>
      <td>
        <span className={styles.bookText}>{row.bestBook}</span>
      </td>
      <td>
        <FairCell fairPrice={row.fairPrice} meta={row.fairPriceMeta} />
      </td>
      <td>
        <EdgeCell value={row.probabilityGap} tone={probabilityGapTone} />
      </td>
      <td>
        <div className={styles.statusCell}>
          <EdgeCell value={row.ev} tone={row.evTone} />
          {row.evMeta ? <span className={styles.booksMeta}>{row.evMeta}</span> : null}
        </div>
      </td>
      <td>
        <div className={styles.statusCell}>
          <span
            className={[
              styles.priceSignal,
              row.priceSignalTone === "positive" ? styles.signalPositive : "",
              row.priceSignalTone === "warning" ? styles.signalWarning : "",
              row.priceSignalTone === "danger" ? styles.signalDanger : ""
            ].join(" ")}
          >
            {row.priceSignal}
          </span>
          <span className={styles.booksMeta}>{row.priceSignalMeta}</span>
        </div>
      </td>
      <td>
        <div className={styles.statusCell}>
          <ConfidenceBadge label={row.confidence} bucket={row.confidenceBucket} isStale={row.isStale} detail={row.confidenceDetail || row.suppressionReason} />
        </div>
      </td>
      <td className={styles.hideOnMobile}>
        <BooksCell value={row.coverage} meta={row.coverageMeta} />
      </td>
      <td>
        <div className={styles.statusCell}>
          <span className={styles.booksMeta} title="How markets are moving right now">
            {row.marketStatus}
          </span>
          <span className={styles.startText}>{row.startTime}</span>
          {row.staleLabel ? <span className={styles.booksMeta}>{row.staleLabel}</span> : null}
        </div>
      </td>
      <td className={styles.hideOnMobile}>
        <div className={styles.statusCell}>
          <FreshnessCell updated={row.updated} isStale={row.isStale} />
        </div>
      </td>
    </tr>
  );
}
