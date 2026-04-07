"use client";

import { memo, useMemo, useState } from "react";
import type { BoardDrilldownRow } from "@/lib/server/odds/types";
import styles from "./BoardShell.module.css";
import { ConfidencePill } from "@/components/board/ConfidencePill";

function formatAmerican(price: number): string {
  if (!Number.isFinite(price)) return "--";
  return price > 0 ? `+${Math.round(price)}` : `${Math.round(price)}`;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "--";
  return `${(value * 100).toFixed(2)}%`;
}

function formatValue(value: number): string {
  if (!Number.isFinite(value)) return "$0.00 / $100";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}$${value.toFixed(2)} / $100`;
}

function formatGap(value: number): string {
  if (!Number.isFinite(value)) return "--";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}pp`;
}

function valueTone(value: number): string {
  if (value >= 0.2) return styles.valuePositive;
  if (value <= -0.2) return styles.valueNegative;
  return styles.valueNeutral;
}

function gapTone(value: number): string {
  if (value >= 0.5) return styles.gapPositive;
  if (value <= -0.5) return styles.gapNegative;
  return styles.gapNeutral;
}

function positionLabel(position: "above_market" | "at_market" | "below_market"): string {
  if (position === "above_market") return "Above Market";
  if (position === "below_market") return "Below Market";
  return "At Market";
}

function signalLabel(value: number): string {
  if (value >= 1.5) return "Strong edge";
  if (value >= 0.5) return "Model edge";
  if (value <= -0.5) return "Below fair";
  return "Near fair";
}

type BoardRowProps = {
  row: BoardDrilldownRow;
  variant?: "table" | "card";
};

function BoardRowComponent({ row, variant = "table" }: BoardRowProps) {
  const [expanded, setExpanded] = useState(false);
  const toggleLabel = expanded ? "Hide Detail" : "View Detail";
  const detailId = variant === "card" ? `mobile-detail-${row.id}` : `detail-${row.id}`;
  const sortedOffers = useMemo(
    () => [...row.expanded.offers].sort((a, b) => b.valuePer100 - a.valuePer100),
    [row.expanded.offers]
  );
  const bestOffer = useMemo(
    () => row.expanded.offers.find((offer) => offer.book === row.bestBook) ?? sortedOffers[0] ?? null,
    [row.bestBook, row.expanded.offers, sortedOffers]
  );
  const coverageRequired = Math.max(1, row.coverageRequiredBooks ?? row.booksInConsensus);
  const coverageBooks = row.coverageBooks ?? row.booksInConsensus;
  const coverageStatus = `${coverageBooks}/${coverageRequired} books`;
  const bestGap = bestOffer?.probabilityDiffVsMarket ?? 0;

  const detailsContent = (
    <>
      <div className={styles.drilldownSection}>
        <h4 className={styles.drilldownTitle}>Market Summary</h4>
        <div className={styles.summaryGrid}>
          <div>
            <span>Fair Line</span>
            <strong>{formatAmerican(row.expanded.weightedMarketFairOdds)}</strong>
          </div>
          <div>
            <span>Fair Probability</span>
            <strong>{formatPercent(row.expanded.weightedMarketFairProbability)}</strong>
          </div>
          <div>
            <span>Best Book</span>
            <strong>{row.bestBook}</strong>
          </div>
          <div>
            <span>Total Weight</span>
            <strong>{row.expanded.totalWeight.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      <div className={styles.drilldownSection}>
        <h4 className={styles.drilldownTitle}>Book Comparison</h4>
        <table className={styles.detailTable}>
          <thead>
            <tr>
              <th>Book</th>
              <th>Line</th>
              <th>Odds</th>
              <th>No-Vig</th>
              <th>Gap</th>
              <th>Value</th>
              <th>Position</th>
            </tr>
          </thead>
          <tbody>
            {sortedOffers.map((offer) => (
              <tr key={`${row.id}:${offer.book}`}>
                <td>{offer.book}</td>
                <td>{row.market.replace(/^.+\s(?=[+-]?\d|ML)/, "")}</td>
                <td>{formatAmerican(offer.americanOdds)}</td>
                <td>{formatPercent(offer.devigProbability)}</td>
                <td className={gapTone(offer.probabilityDiffVsMarket)}>{formatGap(offer.probabilityDiffVsMarket)}</td>
                <td className={valueTone(offer.valuePer100)}>{formatValue(offer.valuePer100)}</td>
                <td>{positionLabel(offer.position)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.drilldownSection}>
        <p className={styles.explanationText}>
          Fair odds remove vig inside each exact market group before weighted aggregation. Probability gap compares fair probability to the break-even rate of the offered price.
        </p>
      </div>
    </>
  );

  if (variant === "card") {
    return (
      <article className={styles.mobileCard}>
        <div className={styles.mobileTop}>
          <div className={styles.eventCell}>
            <strong>{row.event}</strong>
            <span>{row.isLive ? "Live" : new Date(row.commenceTime).toLocaleString("en-US", { timeZone: "America/New_York" })}</span>
          </div>
          <span className={styles.rowStatus}>{row.isLive ? "Live" : "Upcoming"}</span>
        </div>

        <div className={styles.mobilePick}>{row.market}</div>

        <div className={styles.mobileComparison}>
          <div>
            <span>Best Price</span>
            <strong>
              {formatAmerican(row.bestOdds)} <em>@ {row.bestBook}</em>
            </strong>
          </div>
          <div>
            <span>Fair Line</span>
            <strong>{formatAmerican(row.marketFairOdds)}</strong>
          </div>
          <div>
            <span>Prob Gap</span>
            <strong className={gapTone(bestGap)}>{formatGap(bestGap)}</strong>
          </div>
          <div>
            <span>Signal</span>
            <strong>{signalLabel(bestGap)}</strong>
          </div>
        </div>

        <div className={styles.mobileMetaRow}>
          <strong className={valueTone(row.valuePer100)}>{formatValue(row.valuePer100)}</strong>
          {row.confidenceLabel ? <ConfidencePill label={row.confidenceLabel} /> : null}
          <span className={styles.coverageMeta}>{coverageStatus}</span>
        </div>

        <button
          type="button"
          className={styles.detailToggle}
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={detailId}
        >
          {toggleLabel}
        </button>

        {expanded ? <div id={detailId}>{detailsContent}</div> : null}
      </article>
    );
  }

  return (
    <>
      <tr className={styles.tableRow}>
        <td>
          <div className={styles.eventCell}>
            <strong>{row.event}</strong>
            <span>{row.isLive ? "Live" : new Date(row.commenceTime).toLocaleString("en-US", { timeZone: "America/New_York" })}</span>
          </div>
        </td>
        <td>
          <div className={styles.marketCell}>
            <strong>{row.market}</strong>
            <span className={`${styles.signalText} ${gapTone(bestGap)}`}>{signalLabel(bestGap)}</span>
          </div>
        </td>
        <td>
          <div className={styles.priceCluster}>
            <strong className={styles.priceValue}>{formatAmerican(row.bestOdds)}</strong>
            <span>@ {row.bestBook}</span>
          </div>
        </td>
        <td>
          <div className={styles.priceCluster}>
            <strong className={styles.priceValue}>{formatAmerican(row.marketFairOdds)}</strong>
            <span>Model consensus</span>
          </div>
        </td>
        <td>
          <strong className={`${styles.gapValue} ${gapTone(bestGap)}`}>{formatGap(bestGap)}</strong>
        </td>
        <td>
          <div className={styles.valueCell}>
            <strong className={valueTone(row.valuePer100)}>{formatValue(row.valuePer100)}</strong>
            <span>Expected return</span>
          </div>
        </td>
        <td>
          <div className={styles.confidenceCell}>
            {row.confidenceLabel ? <ConfidencePill label={row.confidenceLabel} /> : null}
            <span className={styles.coverageMeta}>{coverageStatus}</span>
          </div>
        </td>
        <td>
          <button
            type="button"
            className={styles.detailToggle}
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls={detailId}
          >
            {toggleLabel}
          </button>
        </td>
      </tr>
      {expanded ? (
        <tr id={detailId} className={styles.detailRow}>
          <td colSpan={6}>
            {detailsContent}
          </td>
        </tr>
      ) : null}
    </>
  );
}

export const BoardRow = memo(BoardRowComponent);
