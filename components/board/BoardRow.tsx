import { memo } from "react";
import type { FairEvent } from "@/lib/server/odds/types";
import styles from "./BoardShell.module.css";
import { EdgeBadge } from "@/components/board/EdgeBadge";
import { Button } from "@/components/ui/Button";
import { bestPriceBook, formatCommenceTime, formatMarketLabel, formatOffer, strongestBook, strongestOutcome } from "@/components/board/board-helpers";
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
  const bestLineBook = bestPriceBook(outcome);
  const directive = book && book.edgePct < 0 ? `Market Mispricing: ${outcome.name} Overpriced` : `Best Bet: ${outcome.name}`;
  const edgeContext = book ? (book.edgePct >= 0 ? "Better than market average" : "Overpriced at this book") : "No live comparison available.";

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
          <span className={styles.metaText}>{formatMarketLabel(event.market)}</span>
        </div>
      </td>
      <td>
        <div className={styles.signalCell}>
          <span className={styles.cellValue}>{outcome.name}</span>
          <span className={styles.topSideDirective}>{directive}</span>
          <div className={styles.metaLine}>
            <span className={styles.cellValue}>{bestLineBook ? formatOffer(event.market, bestLineBook) : "--"}</span>
            <span className={styles.metaText}>{bestLineBook ? bestLineBook.title : "No Live Book"}</span>
          </div>
          <span className={styles.metaText}>{`Fair: ${formatOffer(event.market, outcome)}`}</span>
        </div>
      </td>
      <td>
        <div className={styles.edgeCell}>
          {book ? <EdgeBadge edgePct={book.edgePct} size="lg" /> : <span className={styles.cellValue}>--</span>}
          <span className={styles.metaText}>{edgeContext}</span>
        </div>
      </td>
      <td className={styles.ctaCell}>
        <Button onClick={onToggle} active={expanded}>
          {expanded ? "Hide Details" : "Show Details"}
        </Button>
        <Button variant="ghost" onClick={onOpenDrawer}>
          Books
        </Button>
      </td>
    </tr>
  );
}

export const BoardRow = memo(BoardRowComponent);
