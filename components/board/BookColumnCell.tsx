import type { FairEvent, FairOutcomeBook } from "@/lib/server/odds/types";
import styles from "./BoardShell.module.css";
import { EdgeBadge } from "@/components/board/EdgeBadge";
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
  return (
    <div className={cn(styles.detailRow, book.isBestPrice && styles.detailRowBest)}>
      <div>
        <div className={styles.bookLabel}>{book.title}</div>
        <div className={styles.bookMeta}>
          {book.tier === "sharp" ? "Sharp market maker" : book.tier} · weight {book.weight.toFixed(2)}x
        </div>
      </div>
      <div className={styles.bookOdds}>{formatOffer(event.market, book)}</div>
      <EdgeBadge edgePct={book.edgePct} />
      <div className={styles.rateNote}>
        {book.isBestPrice ? <Pill tone="positive">Best price</Pill> : null}
        {!compact && book.staleSummary ? <span className={styles.bookMeta}>{book.staleSummary}</span> : null}
      </div>
    </div>
  );
}
