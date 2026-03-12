import { memo } from "react";
import type { FairEvent } from "@/lib/server/odds/types";
import styles from "./BoardShell.module.css";
import { BestPriceCell } from "@/components/board/BestPriceCell";
import { FairOddsCell } from "@/components/board/FairOddsCell";
import { EdgeBadge } from "@/components/board/EdgeBadge";
import { MovementPill } from "@/components/board/MovementPill";
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
            <Pill>{outcome.name}</Pill>
          </div>
        </div>
      </td>
      <td>
        <div className={styles.signalCell}>
          <span className={styles.cellLabel}>Top side</span>
          <span className={styles.cellValue}>{outcome.name}</span>
          <span className={styles.subtle}>{book ? `${book.title} has the largest current gap.` : "No live comparison available."}</span>
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
          {book ? <span className={styles.subtle}>{book.title}</span> : null}
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
