import Link from "next/link";
import type { FairEvent } from "@/lib/server/odds/types";
import styles from "./BoardShell.module.css";
import { BookColumnCell } from "@/components/board/BookColumnCell";
import { BestPriceCell } from "@/components/board/BestPriceCell";
import { FairOddsCell } from "@/components/board/FairOddsCell";
import { eventDetailHref, formatCommenceTime, formatMarketLabel, strongestOutcome } from "@/components/board/board-helpers";
import { ConfidencePill } from "@/components/board/ConfidencePill";
import { MovementPill } from "@/components/board/MovementPill";
import { EdgeBadge } from "@/components/board/EdgeBadge";
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
            <ConfidencePill label={event.confidenceLabel} />
          </div>
        </div>

        <div className={styles.detailNotes}>
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
            <div className={styles.cellLabel}>Market note</div>
            <div className={styles.detailCopy}>{outcome.explanation}</div>
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
