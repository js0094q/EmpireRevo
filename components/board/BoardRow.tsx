import { memo } from "react";
import Link from "next/link";
import type { FairEvent } from "@/lib/server/odds/types";
import styles from "./BoardShell.module.css";
import { EdgeBadge } from "@/components/board/EdgeBadge";
import {
  buildPickSummary,
  formatCommenceTime,
  formatMarketLabel,
  formatOffer,
  formatProbabilityGap
} from "@/components/board/board-helpers";
import { cn } from "@/lib/ui/cn";
import { TeamAvatar } from "@/components/board/TeamAvatar";

type BoardRowProps = {
  event: FairEvent;
  detailHref: string;
};

function BoardRowComponent({ event, detailHref }: BoardRowProps) {
  const pick = buildPickSummary(event);
  const probabilityGapPct = pick.probabilityGapPct;
  const fairValueLabel = formatOffer(event.market, pick.outcome);

  return (
    <tr className={cn(styles.tableRow)}>
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
        <div className={styles.signalCell} aria-label="Decision summary">
          <strong className={styles.pickOutcomeName}>{pick.outcome.name}</strong>
          <span className={styles.cellLabel}>Fair Line</span>
          <div className={styles.pickLineValue}>{fairValueLabel}</div>
          <div className={styles.summaryStatRow}>
            <span className={styles.cellLabel}>Probability Gap</span>
            <span className={styles.edgeInlineValue}>{pick.book ? formatProbabilityGap(probabilityGapPct) : "--"}</span>
          </div>
          {event.historySummaryLabel ? <p className={styles.whyPickCopy}>{event.historySummaryLabel}</p> : null}
        </div>
      </td>
      <td>
        <div className={styles.edgeCell}>
          {pick.book ? <EdgeBadge edgePct={pick.probabilityGapPct} size="lg" /> : <span className={styles.cellValue}>--</span>}
          <span className={styles.metaText}>Probability Gap</span>
        </div>
      </td>
      <td className={styles.ctaCell}>
        <Link href={detailHref} className={styles.ctaLink}>
          View Game Detail
        </Link>
      </td>
    </tr>
  );
}

export const BoardRow = memo(BoardRowComponent);
