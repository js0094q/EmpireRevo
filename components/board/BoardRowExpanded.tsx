import Link from "next/link";
import type { FairEvent } from "@/lib/server/odds/types";
import styles from "./BoardShell.module.css";
import { BookColumnCell } from "@/components/board/BookColumnCell";
import { BestPriceCell } from "@/components/board/BestPriceCell";
import { FairOddsCell } from "@/components/board/FairOddsCell";
import {
  bestPriceBook,
  eventDetailHref,
  formatCommenceTime,
  formatMarketLabel,
  formatOffer,
  strongestBook,
  strongestOutcome
} from "@/components/board/board-helpers";
import { EdgeBadge, getEdgeTierLabel } from "@/components/board/EdgeBadge";
import { Button } from "@/components/ui/Button";
import { TeamAvatar } from "@/components/board/TeamAvatar";
import { Pill } from "@/components/ui/Pill";

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
  const edgeTierLabel = summaryBook && summaryBook.edgePct >= 0 ? getEdgeTierLabel(summaryBook.edgePct) : null;
  const hasSharpBook = event.outcomes.some((entry) => entry.books.some((book) => book.isSharpBook || book.tier === "sharp"));
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
        <div className={styles.detailHeader}>
          <div>
            <div className={styles.matchupTeams}>
              <TeamAvatar name={event.awayTeam} logoUrl={event.awayLogoUrl} size="md" showName={false} />
              <TeamAvatar name={event.homeTeam} logoUrl={event.homeLogoUrl} size="md" showName={false} />
            </div>
            <div className={styles.cellLabel}>{formatMarketLabel(event.market)}</div>
            <div className={styles.detailTitle}>
              {event.awayTeam} @ {event.homeTeam}
            </div>
            <div className={styles.expandedMeta}>{formatCommenceTime(event.commenceTime)}</div>
          </div>
          <div className={styles.detailPills}>
            <EdgeBadge edgePct={event.maxAbsEdgePct} />
            <Pill>{event.confidenceLabel}</Pill>
          </div>
        </div>

        <div className={styles.detailNotes}>
          <div className={styles.recommendationSummary}>
            <div className={styles.recommendationRow}>
              <span className={styles.cellLabel}>Recommended Side</span>
              <span className={styles.detailCopy}>{outcome.name}</span>
              <span className={styles.topSideDirective}>{`Best Bet: ${outcome.name}`}</span>
            </div>
            <div className={styles.recommendationRow}>
              <span className={styles.cellLabel}>Best Line</span>
              <span className={styles.detailCopy}>
                {bestLineBook ? `${formatOffer(event.market, bestLineBook)} (${bestLineBook.title})` : "--"}
              </span>
            </div>
            <div className={styles.recommendationRow}>
              <span className={styles.cellLabel}>Fair Value</span>
              <span className={styles.detailCopy}>{formatOffer(event.market, outcome)}</span>
            </div>
            <div className={styles.recommendationRow}>
              <span className={styles.cellLabel}>Edge</span>
              {summaryBook ? <EdgeBadge edgePct={summaryBook.edgePct} /> : <span className={styles.detailCopy}>--</span>}
              {edgeTierLabel ? <span className={styles.edgeTierHint}>{edgeTierLabel}</span> : null}
              {summaryBook ? (
                <span className={styles.edgeContextNote}>{summaryBook.edgePct >= 0 ? "Better than market average" : "Overpriced at this book"}</span>
              ) : null}
            </div>
          </div>
          <div className={styles.note}>
            <div className={styles.cellLabel}>Top side</div>
            <div className={styles.detailCopy}>{outcome.name}</div>
          </div>
          <div className={styles.note}>
            <BestPriceCell event={event} outcome={outcome} />
          </div>
          <div className={styles.note}>
            <FairOddsCell event={event} outcome={outcome} />
          </div>
          <div className={styles.note}>
            <div className={styles.cellLabel}>Timing</div>
            <div className={styles.detailCopy}>{outcome.timingSignal.label}</div>
            <div className={styles.subtle}>{outcome.movementSummary}</div>
          </div>
        </div>

        <div className={styles.stateActions}>
          {href ? (
            <Link href={href} className="app-link">
              Open event page
            </Link>
          ) : null}
          {onClose ? <Button onClick={onClose}>Close</Button> : null}
        </div>
      </section>

      <section className={styles.detailPanel}>
        <div className={styles.detailHeader}>
          <h3>Sportsbook comparison</h3>
          {hasSharpBook ? (
            <span className={styles.sharpBookBadge} title="Sharp books reflect more efficient market pricing and are often used as reference points.">
              <span className={styles.sharpBookBadgeDot} aria-hidden="true" />
              Sharp Book
            </span>
          ) : null}
        </div>
        {hasSharpBook ? (
          <p className={styles.sharpBookNote}>Sharp books reflect more efficient market pricing and are often used as reference points.</p>
        ) : null}
        {event.outcomes.map((side) => {
          const highlightBook = strongestBook(side);
          const sharpBooks = side.books.filter((book) => book.isSharpBook || book.tier === "sharp");
          const otherBooks = side.books.filter((book) => !(book.isSharpBook || book.tier === "sharp"));
          return (
            <div key={`${event.id}-${side.name}`} className={styles.note}>
              <div className={styles.detailHeader}>
                <div>
                  <div className={styles.bookLabel}>{side.name}</div>
                  <div className={styles.subtle}>Book-by-book prices and edge for this side.</div>
                  <div className={styles.topSideDirective}>{`Best Bet: ${side.name}`}</div>
                </div>
                {highlightBook ? <EdgeBadge edgePct={highlightBook.edgePct} /> : null}
              </div>
              {highlightBook ? (
                <div className={styles.metaLine}>
                  <span className={styles.edgeContextNote}>{highlightBook.edgePct >= 0 ? "Better than market average" : "Overpriced at this book"}</span>
                  {highlightBook.edgePct >= 0 ? <span className={styles.edgeTierHint}>{getEdgeTierLabel(highlightBook.edgePct)}</span> : null}
                </div>
              ) : null}
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
