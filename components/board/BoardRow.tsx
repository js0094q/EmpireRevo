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
  const edgeTone = row.edgeValue >= 1 ? "positive" : row.edgeValue > 0 ? "warning" : "neutral";

  return (
    <tr className={styles.row}>
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
        <EdgeCell value={row.edge} tone={edgeTone} />
      </td>
      <td>
        <div className={styles.statusCell}>
          <ConfidenceBadge label={row.confidence} />
          {row.suppressionReason ? <span className={styles.booksMeta}>{row.suppressionReason}</span> : null}
        </div>
      </td>
      <td>
        <BooksCell value={row.books} meta={row.marketStatus} />
      </td>
      <td>
        <div className={styles.statusCell}>
          <FreshnessCell updated={row.updated} isStale={row.isStale} />
        </div>
      </td>
    </tr>
  );
}
