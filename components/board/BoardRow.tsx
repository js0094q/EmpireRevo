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
  const probabilityGapTone = row.probabilityGapValue >= 1 ? "positive" : row.probabilityGapValue > 0 ? "warning" : row.probabilityGapValue < 0 ? "danger" : "neutral";
  const evTone = row.evValue === null ? "neutral" : row.evValue >= 1 ? "positive" : row.evValue > 0 ? "warning" : row.evValue < 0 ? "danger" : "neutral";

  return (
    <tr className={[styles.row, row.isActionable ? styles.rowActionable : "", row.isStale ? styles.rowStale : ""].join(" ")}>
      <td>
        <div className={styles.eventCell}>
          <Link href={row.href} className={styles.rowLink}>
            <span className={styles.eventName}>{row.event}</span>
          </Link>
          <span className={styles.eventMeta}>{row.eventMeta}</span>
        </div>
      </td>
      <td>
        <div className={styles.marketCell}>
          <span>{row.market}</span>
          <span className={styles.cellMeta}>{row.marketMeta}</span>
        </div>
      </td>
      <td>
        <BestLineCell bestPrice={row.bestPrice} pinnedPrice={row.bestPinnedPrice} />
      </td>
      <td>
        <span className={styles.bookText}>{row.bestBook}</span>
      </td>
      <td>
        <FairCell fairPrice={row.fairPrice} />
      </td>
      <td>
        <div className={styles.statusCell}>
          <span className={[styles.priceSignal, row.priceSignalTone === "positive" ? styles.signalPositive : "", row.priceSignalTone === "warning" ? styles.signalWarning : "", row.priceSignalTone === "danger" ? styles.signalDanger : ""].join(" ")}>
            {row.priceSignal}
          </span>
          <span className={styles.booksMeta}>{row.priceSignalMeta}</span>
        </div>
      </td>
      <td>
        <EdgeCell value={row.probabilityGap} tone={probabilityGapTone} />
      </td>
      <td>
        <div className={styles.statusCell}>
          <EdgeCell value={row.ev} tone={evTone} />
          {row.evMeta ? <span className={styles.booksMeta}>{row.evMeta}</span> : null}
        </div>
      </td>
      <td>
        <div className={styles.statusCell}>
          <ConfidenceBadge label={row.confidence} />
          {row.suppressionReason ? <span className={styles.booksMeta}>{row.suppressionReason}</span> : null}
        </div>
      </td>
      <td>
        <BooksCell value={row.coverage} meta={row.coverageMeta} />
      </td>
      <td>
        <span className={styles.startText}>{row.startTime}</span>
      </td>
      <td>
        <div className={styles.statusCell}>
          <FreshnessCell updated={row.updated} isStale={row.isStale} />
        </div>
      </td>
    </tr>
  );
}
