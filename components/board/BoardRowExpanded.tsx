import Link from "next/link";
import type { FairEvent } from "@/lib/server/odds/types";
import styles from "./BoardShell.module.css";
import { BookColumnCell } from "@/components/board/BookColumnCell";
import {
  bestPriceBook,
  eventDetailHref,
  formatCommenceTime,
  formatOffer,
  strongestBook,
  strongestOutcome
} from "@/components/board/board-helpers";
import { EdgeBadge, getEdgeTierLabel } from "@/components/board/EdgeBadge";
import { Button } from "@/components/ui/Button";
import { TeamAvatar } from "@/components/board/TeamAvatar";

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
  const outcome = strongestOutcome(event);
  const summaryBook = strongestBook(outcome);
  const bestLineBook = bestPriceBook(outcome);
  const edgeTierLabel = summaryBook && summaryBook.edgePct >= 0 ? getEdgeTierLabel(summaryBook.edgePct) : "Watch";
  const summaryDirective =
    summaryBook && summaryBook.edgePct < 0 ? `Market Mispricing: ${outcome.name} Overpriced` : `Best Bet: ${outcome.name}`;
  const href = event.outcomes.length
    ? eventDetailHref({
        eventId: event.id,
        league,
        market: event.market,
        model
      })
    : null;

  return (
    <div className={compact ? styles.drawerDetail : styles.expandedGrid}>
      <section className={styles.detailPanel}>
        <div className={styles.expandedSummary}>
          <div className={styles.matchupTeams}>
            <TeamAvatar name={event.awayTeam} logoUrl={event.awayLogoUrl} size="md" showName={false} />
            <TeamAvatar name={event.homeTeam} logoUrl={event.homeLogoUrl} size="md" showName={false} />
          </div>
          <div className={styles.detailTitle}>
            {event.awayTeam} @ {event.homeTeam}
          </div>
          <div className={styles.metaText}>{formatCommenceTime(event.commenceTime)}</div>
          <div className={styles.topSideDirective}>{summaryDirective}</div>

          <div className={styles.summaryStatRow}>
            <span className={styles.cellLabel}>Best Line</span>
            <span className={styles.detailCopy}>{bestLineBook ? `${formatOffer(event.market, bestLineBook)} (${bestLineBook.title})` : "--"}</span>
          </div>
          <div className={styles.summaryStatRow}>
            <span className={styles.cellLabel}>Fair Value</span>
            <span className={styles.detailCopy}>{formatOffer(event.market, outcome)}</span>
          </div>
          <div className={styles.summaryStatRow}>
            <span className={styles.cellLabel}>Edge</span>
            {summaryBook ? <EdgeBadge edgePct={summaryBook.edgePct} size="lg" /> : <span className={styles.detailCopy}>--</span>}
            {summaryBook ? <span className={styles.metaText}>{edgeTierLabel}</span> : null}
          </div>
        </div>

        <div className={styles.stateActions}>
          {href ? (
            <Link href={href} className="app-link">
              Open Event Page
            </Link>
          ) : null}
          {onClose ? <Button onClick={onClose}>Close</Button> : null}
        </div>
      </section>

      <section className={styles.detailPanel}>
        <div className={styles.detailHeader}>
          <h3>Book Table</h3>
        </div>
        {event.outcomes.map((side) => {
          const highlightBook = strongestBook(side);
          const sharpBooks = side.books.filter((book) => book.isSharpBook || book.tier === "sharp");
          const otherBooks = side.books.filter((book) => !(book.isSharpBook || book.tier === "sharp"));
          return (
            <div key={`${event.id}-${side.name}`} className={styles.note}>
              <div className={styles.detailHeader}>
                <div className={styles.bookLabel}>{side.name}</div>
                {highlightBook ? <EdgeBadge edgePct={highlightBook.edgePct} /> : null}
              </div>
              {sharpBooks.length ? (
                <div className={styles.bookGroupBlock}>
                  <div className={styles.bookGroupLabel}>Sharp Books</div>
                  <div className={styles.detailList}>
                    {sharpBooks.map((book) => (
                      <BookColumnCell key={`${event.id}-${side.name}-${book.bookKey}`} event={event} book={book} compact={compact} />
                    ))}
                  </div>
                </div>
              ) : null}
              {otherBooks.length ? (
                <div className={styles.bookGroupBlock}>
                  <div className={styles.bookGroupLabel}>Other Books</div>
                  <div className={styles.detailList}>
                    {otherBooks.map((book) => (
                      <BookColumnCell key={`${event.id}-${side.name}-${book.bookKey}`} event={event} book={book} compact={compact} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </section>
    </div>
  );
}
