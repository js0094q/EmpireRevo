import type { FairEvent, FairOutcomeBook } from "@/lib/server/odds/types";
import styles from "./BoardShell.module.css";
import { EdgeBadge, getEdgeTierLabel } from "@/components/board/EdgeBadge";
import { Pill } from "@/components/ui/Pill";
import { formatOffer } from "@/components/board/board-helpers";
import { cn } from "@/lib/ui/cn";

export function BookColumnCell({
  event,
  book,
  compact = false
}: {
  event: FairEvent;
  book: FairOutcomeBook;
  compact?: boolean;
}) {
  const isSharpBook = book.isSharpBook || book.tier === "sharp";
  const edgeContext =
    book.edgePct >= 0
      ? "Priced more favorably than fair market probability"
      : "Priced less favorably than fair market probability";
  const edgeTierLabel = book.edgePct >= 0 ? getEdgeTierLabel(book.edgePct) : null;

  return (
    <div className={cn(styles.detailRow, book.isBestPrice && styles.detailRowBest, isSharpBook && styles.detailRowSharp)}>
      <div>
        <div className={styles.bookHeader}>
          <div className={styles.bookLabel}>{book.title}</div>
          <div className={styles.bookBadgeRow}>
            {isSharpBook ? (
              <span
                className={styles.sharpBookBadge}
                title="Sharp books reflect more efficient market pricing and are often used as reference points."
              >
                <span className={styles.sharpBookBadgeDot} aria-hidden="true" />
                Sharp
              </span>
            ) : null}
            {book.isBestPrice ? <Pill tone="positive">Best Price</Pill> : null}
          </div>
        </div>
        <div className={styles.bookMeta}>{book.tier === "sharp" ? "Reference Pricing" : "Live Pricing"}</div>
      </div>
      <div className={styles.bookOdds}>{formatOffer(event.market, book)}</div>
      <div className={styles.edgeStack}>
        <EdgeBadge edgePct={book.edgePct} />
        {edgeTierLabel ? <span className={styles.edgeTierHint}>{edgeTierLabel}</span> : null}
      </div>
      <div className={styles.rateNote}>
        <span className={styles.bookMeta}>{edgeContext}</span>
        {!compact && book.staleSummary ? <span className={styles.bookMeta}>{` · ${book.staleSummary}`}</span> : null}
      </div>
    </div>
  );
}
