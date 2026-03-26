import { memo } from "react";
import Link from "next/link";
import type { FairEvent } from "@/lib/server/odds/types";
import styles from "./BoardShell.module.css";
import { EdgeBadge } from "@/components/board/EdgeBadge";
import { buildPickSummary, formatCommenceTime, formatMarketLabel, formatOffer, marketVsModelCopy } from "@/components/board/board-helpers";
import { cn } from "@/lib/ui/cn";
import { TeamAvatar } from "@/components/board/TeamAvatar";

type BoardRowProps = {
  event: FairEvent;
  detailHref: string;
};

function BoardRowComponent({ event, detailHref }: BoardRowProps) {
  const pick = buildPickSummary(event);
  const edgePct = pick.book?.edgePct ?? 0;
  const marketPriceLabel = pick.book ? `${formatOffer(event.market, pick.book)} at ${pick.book.title}` : "--";
  const fairValueLabel = `${formatOffer(event.market, pick.outcome)} (model)`;
  const valueStatement = marketVsModelCopy({
    market: event.market,
    outcome: pick.outcome,
    book: pick.book
  });

  return (
    <tr
      className={cn(
        styles.tableRow,
        pick.book ? (edgePct >= 0 ? styles.tableRowPositive : styles.tableRowNegative) : null
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
        <div className={styles.signalCell} aria-label="Decision summary">
          <div className={styles.recommendationRow}>
            <span className={styles.pickDirectiveLabel}>{pick.label}</span>
            <span className={styles.pickStatus}>{pick.status}</span>
          </div>
          <strong className={styles.pickOutcomeName}>{pick.outcome.name}</strong>
          <div className={styles.pickLineValue}>{pick.book ? formatOffer(event.market, pick.book) : "--"}</div>
          <div className={styles.summaryStatRow}>
            <span className={styles.cellLabel}>Edge</span>
            <span className={styles.edgeInlineValue}>{pick.book ? `${edgePct > 0 ? "+" : ""}${edgePct.toFixed(2)}%` : "--"}</span>
          </div>
          <div className={styles.marketModelMeta}>
            <span>
              <strong>Market Price:</strong> {marketPriceLabel}
            </span>
            <span>
              <strong>Fair Value:</strong> {fairValueLabel}
            </span>
          </div>
          <p className={styles.whyPickCopy}>{valueStatement}</p>
        </div>
      </td>
      <td>
        <div className={styles.edgeCell}>
          {pick.book ? <EdgeBadge edgePct={pick.book.edgePct} size="lg" /> : <span className={styles.cellValue}>--</span>}
          <span className={styles.metaText}>Edge</span>
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
