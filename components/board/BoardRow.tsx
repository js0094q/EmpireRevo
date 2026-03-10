import { memo } from "react";
import type { FairEvent } from "@/lib/server/odds/types";
import styles from "./BoardShell.module.css";
import { BestPriceCell } from "@/components/board/BestPriceCell";
import { FairOddsCell } from "@/components/board/FairOddsCell";
import { ConfidencePill } from "@/components/board/ConfidencePill";
import { EdgeBadge } from "@/components/board/EdgeBadge";
import { MovementPill } from "@/components/board/MovementPill";
import { Button } from "@/components/ui/Button";
import { formatCommenceTime, formatMarketLabel, topBook, topOutcome } from "@/components/board/board-helpers";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/ui/cn";

type BoardRowProps = {
  event: FairEvent;
  expanded: boolean;
  onToggle: () => void;
  onOpenDrawer: () => void;
};

function BoardRowComponent({ event, expanded, onToggle, onOpenDrawer }: BoardRowProps) {
  const outcome = topOutcome(event);
  const book = topBook(outcome);

  return (
    <tr className={cn(styles.tableRow, expanded && styles.tableRowActive)}>
      <td>
        <div className={styles.matchup}>
          <div className={styles.teams}>
            <strong>
              {event.awayTeam} @ {event.homeTeam}
            </strong>
            <span>{formatCommenceTime(event.commenceTime)}</span>
          </div>
          <div className={styles.rowPills}>
            <Pill tone="accent">{formatMarketLabel(event.market)}</Pill>
            <Pill>{outcome.name}</Pill>
            {event.excludedBooks.length ? <Pill tone="warning">Partial market</Pill> : null}
          </div>
        </div>
      </td>
      <td>
        <div className={styles.signalCell}>
          <span className={styles.cellLabel}>Best signal</span>
          <span className={styles.cellValue}>{event.opportunityScore.toFixed(1)}</span>
          <span className={styles.subtle}>{event.rankingSummary}</span>
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
          <div className={styles.rowPills}>
            <ConfidencePill label={event.confidenceLabel} />
          </div>
        </div>
      </td>
      <td>
        <div className={styles.movementCell}>
          <MovementPill outcome={outcome} />
          <span className={styles.subtle}>{outcome.movementSummary}</span>
        </div>
      </td>
      <td className={styles.ctaCell}>
        <Button onClick={onToggle} active={expanded}>
          {expanded ? "Hide books" : "Expand"}
        </Button>
        <div style={{ height: 8 }} />
        <Button variant="ghost" onClick={onOpenDrawer}>
          Quick view
        </Button>
      </td>
    </tr>
  );
}

export const BoardRow = memo(BoardRowComponent);
