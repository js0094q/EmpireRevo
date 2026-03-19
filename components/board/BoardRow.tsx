import { memo } from "react";
import type { FairEvent } from "@/lib/server/odds/types";
import styles from "./BoardShell.module.css";
import { BestPriceCell } from "@/components/board/BestPriceCell";
import { FairOddsCell } from "@/components/board/FairOddsCell";
import { EdgeBadge, getEdgeTierLabel } from "@/components/board/EdgeBadge";
import { Button } from "@/components/ui/Button";
import { formatCommenceTime, formatMarketLabel, strongestBook, strongestOutcome } from "@/components/board/board-helpers";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/ui/cn";
import { TeamAvatar } from "@/components/board/TeamAvatar";

type BoardRowProps = {
  event: FairEvent;
  expanded: boolean;
  onToggle: () => void;
  onOpenDrawer: () => void;
};

function BoardRowComponent({ event, expanded, onToggle, onOpenDrawer }: BoardRowProps) {
  const outcome = strongestOutcome(event);
  const book = strongestBook(outcome);
  const edgeTierLabel = book && book.edgePct >= 0 ? getEdgeTierLabel(book.edgePct) : null;

  return (
    <tr
      className={cn(
        styles.tableRow,
        book ? (book.edgePct >= 0 ? styles.tableRowPositive : styles.tableRowNegative) : null,
        expanded && styles.tableRowActive
      )}
    >
      <td>
        <div className={styles.matchup}>
          <div className={styles.matchupTeams}>
            <TeamAvatar name={event.awayTeam} logoUrl={event.awayLogoUrl} size="sm" showName={false} />
            <TeamAvatar name={event.homeTeam} logoUrl={event.homeLogoUrl} size="sm" showName={false} />
          </div>
          <div className={styles.teams}>
            <strong>
              {event.awayTeam} @ {event.homeTeam}
            </strong>
            <span>{formatCommenceTime(event.commenceTime)}</span>
          </div>
          <div className={styles.rowPills}>
            <Pill tone="accent">{formatMarketLabel(event.market)}</Pill>
          </div>
        </div>
      </td>
      <td>
        <div className={styles.signalCell}>
          <span className={styles.cellValue}>{outcome.name}</span>
          <span className={styles.topSideDirective}>{`Best Bet: ${outcome.name}`}</span>
          <div className={styles.metaLine}>
            <span className={styles.subtle}>{book ? `Best at ${book.title}` : "No live comparison available."}</span>
            {book && (book.isSharpBook || book.tier === "sharp") ? (
              <span
                className={styles.sharpBookBadge}
                title="Sharp books reflect more efficient market pricing and are often used as reference points."
              >
                <span className={styles.sharpBookBadgeDot} aria-hidden="true" />
                Sharp Book
              </span>
            ) : null}
          </div>
        </div>
      </td>
      <td>
        <BestPriceCell event={event} outcome={outcome} />
      </td>
      <td>
        <FairOddsCell event={event} outcome={outcome} />
      </td>
      <td>
        <div className={styles.signalCell}>
          {book ? <EdgeBadge edgePct={book.edgePct} /> : <Pill>Edge --</Pill>}
          {book ? <span className={styles.subtle}>{`${book.title} vs Market Average`}</span> : null}
          {book ? <span className={styles.edgeContextNote}>{book.edgePct >= 0 ? "Better than market average" : "Overpriced at this book"}</span> : null}
          {edgeTierLabel ? <span className={styles.edgeTierHint}>{edgeTierLabel}</span> : null}
        </div>
      </td>
      <td className={styles.ctaCell}>
        <Button onClick={onToggle} active={expanded}>
          {expanded ? "Hide details" : "Show details"}
        </Button>
        <Button variant="ghost" onClick={onOpenDrawer}>
          Books
        </Button>
      </td>
    </tr>
  );
}

export const BoardRow = memo(BoardRowComponent);
