import Link from "next/link";
import type { FairEvent } from "@/lib/server/odds/types";
import styles from "./BoardShell.module.css";
import { BookColumnCell } from "@/components/board/BookColumnCell";
import { formatCommenceTime, formatMarketLabel } from "@/components/board/board-helpers";
import { ConfidencePill } from "@/components/board/ConfidencePill";
import { MovementPill } from "@/components/board/MovementPill";
import { EdgeBadge } from "@/components/board/EdgeBadge";
import { Button } from "@/components/ui/Button";

export function BoardRowExpanded({
  event,
  league,
  model,
  compact = false,
  onClose
}: {
  event: FairEvent;
  league: string;
  model: "sharp" | "equal" | "weighted";
  compact?: boolean;
  onClose?: () => void;
}) {
  return (
    <div className={compact ? styles.drawerDetail : styles.expandedGrid}>
      <section className={styles.detailPanel}>
        <div className={styles.detailHeader}>
          <div>
            <div className={styles.cellLabel}>{formatMarketLabel(event.market)}</div>
            <div>
              {event.awayTeam} @ {event.homeTeam}
            </div>
            <div className={styles.expandedMeta}>{formatCommenceTime(event.commenceTime)}</div>
          </div>
          <div className={styles.detailPills}>
            <ConfidencePill label={event.confidenceLabel} />
            <EdgeBadge edgePct={event.maxAbsEdgePct} />
          </div>
        </div>

        <div className={styles.detailNotes}>
          <div className={styles.note}>
            <div className={styles.cellLabel}>Rank summary</div>
            <div className={styles.detailCopy}>{event.rankingSummary}</div>
          </div>
          <div className={styles.note}>
            <div className={styles.cellLabel}>Coverage</div>
            <div className={styles.detailCopy}>
              {event.contributingBookCount}/{event.totalBookCount} books contributing. Timing signal: {event.timingLabel}.
            </div>
          </div>
          {event.excludedBooks.length ? (
            <div className={styles.note}>
              <div className={styles.cellLabel}>Partial data</div>
              <div className={styles.detailCopy}>
                {event.excludedBooks.length} books were excluded due to missing market coverage or equivalent-line mismatch.
              </div>
            </div>
          ) : null}
        </div>

        <div className={styles.stateActions}>
          <Link href={`/game/${event.id}?league=${league}&market=${event.market}&model=${model}`} className="app-link">
            Open event page
          </Link>
          {onClose ? <Button onClick={onClose}>Close</Button> : null}
        </div>
      </section>

      <section className={styles.detailPanel}>
        <h3>By outcome</h3>
        {event.outcomes.map((outcome) => (
          <div key={`${event.id}-${outcome.name}`} className={styles.note}>
            <div className={styles.detailHeader}>
              <div>
                <div className={styles.bookLabel}>{outcome.name}</div>
                <div className={styles.detailCopy}>{outcome.explanation}</div>
              </div>
              <div className={styles.detailPills}>
                <MovementPill outcome={outcome} />
                <EdgeBadge edgePct={Math.max(...outcome.books.map((book) => book.edgePct), 0)} />
              </div>
            </div>
            <div className={styles.detailList}>
              {outcome.books
                .slice()
                .sort((a, b) => Number(b.isBestPrice) - Number(a.isBestPrice) || b.edgePct - a.edgePct)
                .map((book) => (
                  <BookColumnCell key={`${event.id}-${outcome.name}-${book.bookKey}`} event={event} book={book} compact={compact} />
                ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
