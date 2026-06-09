import Link from "next/link";
import { Fragment } from "react";
import { Badge } from "@/components/primitives/Badge";
import { BestLineCell } from "@/components/board/BestLineCell";
import { ConfidenceBadge } from "@/components/board/ConfidenceBadge";
import { EdgeCell } from "@/components/board/EdgeCell";
import { FairCell } from "@/components/board/FairCell";
import { FreshnessCell } from "@/components/board/FreshnessCell";
import type { BoardRowViewModel } from "@/lib/ui/view-models/boardViewModel";
import styles from "./workstation.module.css";

export function BoardRow({ row, expandByDefault = false }: { row: BoardRowViewModel; expandByDefault?: boolean }) {
  return (
    <Fragment>
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
            <span className={styles.cellMeta}>{row.marketStatus}</span>
          </div>
        </td>
        <td>
          <div className={styles.marketCell}>
            <span className={styles.bookText}>{row.selection}</span>
            <span className={styles.cellMeta}>{row.marketMeta}</span>
          </div>
        </td>
        <td>
          <span className={styles.bookPill} title={row.bestBook}>{row.bestBookAbbrev}</span>
          <span className={styles.booksMeta}>{row.bestBook}</span>
        </td>
        <td>
          <BestLineCell bestPrice={row.bestPrice} meta={row.bestPriceMeta} pinnedPrice={row.bestPinnedPrice} />
        </td>
        <td>
          <FairCell fairPrice={row.fairPrice} meta={row.fairPriceMeta} />
        </td>
        <td>
          <div className={styles.statusCell}>
            <EdgeCell value={row.ev} tone={row.evTone} />
            {row.evMeta ? <span className={styles.booksMeta}>{row.evMeta}</span> : null}
          </div>
        </td>
        <td>
          <div className={styles.statusCell}>
            <ConfidenceBadge label={row.confidence} bucket={row.confidenceBucket} isStale={row.isStale} detail={row.confidenceDetail || row.suppressionReason} />
          </div>
        </td>
        <td className={styles.hideOnMobile}>
          <div className={styles.statusCell}>
            <FreshnessCell updated={row.updated} isStale={row.isStale} />
            {row.staleLabel ? <span className={styles.booksMeta}>{row.staleLabel}</span> : null}
          </div>
        </td>
        <td className={styles.hideOnMobile}>
          <Badge tone={row.pinnedAvailabilityTone}>{row.pinnedAvailability}</Badge>
        </td>
        <td>
          <Badge tone={row.outcomeTone}>{row.outcomeLabel}</Badge>
        </td>
      </tr>
      <tr className={styles.explanationRow}>
        <td colSpan={11}>
          <details className={styles.signalDetails} open={expandByDefault}>
            <summary>Why this signal?</summary>
            <dl>
              {row.whySignal.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </details>
        </td>
      </tr>
    </Fragment>
  );
}
