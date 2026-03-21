"use client";

import Link from "next/link";
import type { FairEvent } from "@/lib/server/odds/types";
import styles from "./BoardShell.module.css";
import { BoardRow } from "@/components/board/BoardRow";
import {
  buildPickSummary,
  eventDetailHref,
  formatCommenceTime,
  formatMarketLabel,
  formatOffer,
  type BoardNavigationContext
} from "@/components/board/board-helpers";
import { TeamAvatar } from "@/components/board/TeamAvatar";
import { EdgeBadge } from "@/components/board/EdgeBadge";

type BoardTableProps = {
  events: FairEvent[];
  league: string;
  model: "sharp" | "equal" | "weighted";
  navContext: BoardNavigationContext;
};

export function BoardTable({ events, league, model, navContext }: BoardTableProps) {
  return (
    <section className={styles.tableWrap}>
      <div className={styles.tableHeader}>
        <div>
          <div className={styles.tableHeadTitle}>Board</div>
          <div className={styles.tableHeadMeta}>Scan matchups, see the recommended side, and open each game for full context.</div>
        </div>
      </div>

      <div className={styles.tableScroller}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Matchup</th>
              <th>Decision Summary</th>
              <th>Edge</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <BoardRow
                key={event.id}
                event={event}
                detailHref={eventDetailHref({
                  event,
                  league,
                  market: event.market,
                  model,
                  context: navContext
                })}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.cards}>
        {events.map((event) => {
          const pick = buildPickSummary(event);
          const detailHref = eventDetailHref({
            event,
            league,
            market: event.market,
            model,
            context: navContext
          });

          return (
            <article key={`card-${event.id}`} className={styles.card}>
              <div className={styles.cardTop}>
                <div>
                  <div className={styles.matchupTeams}>
                    <TeamAvatar name={event.awayTeam} logoUrl={event.awayLogoUrl} size="sm" showName={false} />
                    <TeamAvatar name={event.homeTeam} logoUrl={event.homeLogoUrl} size="sm" showName={false} />
                  </div>
                  <strong>
                    {event.awayTeam} @ {event.homeTeam}
                  </strong>
                  <div className={styles.metaText}>{formatCommenceTime(event.commenceTime)}</div>
                </div>
                <div className={styles.edgeStack}>
                  <span className={styles.metaText}>Edge</span>
                  {pick.book ? <EdgeBadge edgePct={pick.book.edgePct} /> : <span className={styles.cellValue}>--</span>}
                </div>
              </div>

              <div className={styles.recommendationRow}>
                <span className={styles.cellLabel}>{pick.label}</span>
                <span className={styles.pickStatus}>{pick.status}</span>
              </div>
              <div className={styles.opportunityPrimary}>
                <strong>{pick.outcome.name}</strong>
              </div>

              <div className={styles.summaryStatRow}>
                <span className={styles.cellLabel}>Best Available Line</span>
                <span className={styles.detailCopy}>{pick.book ? `${formatOffer(event.market, pick.book)} at ${pick.book.title}` : "--"}</span>
              </div>
              <div className={styles.summaryStatRow}>
                <span className={styles.cellLabel}>Fair Value</span>
                <span className={styles.detailCopy}>{formatOffer(event.market, pick.outcome)}</span>
              </div>
              <div className={styles.summaryStatRow}>
                <span className={styles.cellLabel}>Edge</span>
                <span className={styles.detailCopy}>{pick.book ? `${pick.book.edgePct > 0 ? "+" : ""}${pick.book.edgePct.toFixed(2)}%` : "--"}</span>
              </div>
              <p className={styles.metaText}>{formatMarketLabel(event.market)}</p>
              <p className={styles.whyPickCopy}>
                <strong className={styles.whyPickLabel}>Why This Pick:</strong> {pick.whyThisPick}
              </p>

              <div className={styles.stateActions}>
                <Link href={detailHref} className={styles.ctaLink}>
                  View Game Detail
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
