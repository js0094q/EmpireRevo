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

function valueTone(value: number): string {
  if (value >= 0.2) return styles.valuePositive;
  if (value <= -0.2) return styles.valueNegative;
  return styles.valueNeutral;
}

function positionLabel(position: "above_market" | "at_market" | "below_market"): string {
  if (position === "above_market") return "Above Market";
  if (position === "below_market") return "Below Market";
  return "At Market";
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
  const coverageRequired = Math.max(1, row.coverageRequiredBooks ?? row.booksInConsensus);
  const coverageBooks = row.coverageBooks ?? row.booksInConsensus;
  const coverageStatus = `${coverageBooks}/${coverageRequired} books`;

  const detailsContent = (
    <>
      <div className={styles.drilldownSection}>
        <h4 className={styles.drilldownTitle}>Market Summary</h4>
        <div className={styles.summaryGrid}>
          <div>
            <span>Weighted Market Fair Odds</span>
            <strong>{formatAmerican(row.expanded.weightedMarketFairOdds)}</strong>
          </div>
          <div>
            <span>Weighted Market Fair Probability</span>
            <strong>{formatPercent(row.expanded.weightedMarketFairProbability)}</strong>
          </div>
          <div>
            <span>Books in Consensus</span>
            <strong>{row.expanded.booksInConsensus}</strong>
          </div>
          <div>
            <span>Total Consensus Weight</span>
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
              <th>Odds</th>
              <th>Decimal</th>
              <th>Implied Prob</th>
              <th>De-vigged Prob</th>
              <th>Delta vs Market</th>
              <th>Value</th>
              <th>Position</th>
            </tr>
          </thead>
          <tbody>
            {sortedOffers.map((offer) => (
              <tr key={`${row.id}:${offer.book}`}>
                <td>{offer.book}</td>
                <td>{formatAmerican(offer.americanOdds)}</td>
                <td>{offer.decimalOdds.toFixed(2)}</td>
                <td>{formatPercent(offer.impliedProbability)}</td>
                <td>{formatPercent(offer.devigProbability)}</td>
                <td>{`${offer.probabilityDiffVsMarket > 0 ? "+" : ""}${offer.probabilityDiffVsMarket.toFixed(2)}%`}</td>
                <td className={valueTone(offer.valuePer100)}>{formatValue(offer.valuePer100)}</td>
                <td>{positionLabel(offer.position)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.drilldownSection}>
        <p className={styles.explanationText}>
          Fair odds use no-vig probabilities aggregated with book weights. Value compares each book&apos;s payout against that fair line at the same
          side and point.
        </p>
      </div>

      <details className={styles.drilldownSection}>
        <summary className={styles.diagnosticsSummary}>Optional Diagnostics</summary>
        <ul className={styles.diagnosticsList}>
          {sortedOffers.map((offer) => (
            <li key={`${row.id}:${offer.book}:diag`}>
              {offer.book}: value {formatValue(offer.valuePer100)}, delta {offer.probabilityDiffVsMarket.toFixed(2)}%
            </li>
          ))}
        </ul>
      </details>
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
          <span className={styles.recommendedTag}>Recommended</span>
        </div>

        <div className={styles.mobilePick}>{row.market}</div>

        <div className={styles.mobileComparison}>
          <div>
            <span>Best</span>
            <strong>
              {formatAmerican(row.bestOdds)} <em>@ {row.bestBook}</em>
            </strong>
          </div>
          <div>
            <span>Fair</span>
            <strong>{formatAmerican(row.marketFairOdds)}</strong>
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
          <div className={styles.recommendedCell}>
            <span className={styles.recommendedTag}>Recommended</span>
            <strong>{row.market}</strong>
          </div>
        </td>
        <td>
          <div className={styles.priceCompareCell}>
            <span>
              Best: <strong>{formatAmerican(row.bestOdds)}</strong> @ {row.bestBook}
            </span>
            <span>
              Fair: <strong>{formatAmerican(row.marketFairOdds)}</strong>
            </span>
          </div>
        </td>
        <td className={valueTone(row.valuePer100)}>{formatValue(row.valuePer100)}</td>
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
