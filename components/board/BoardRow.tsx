"use client";

import { memo, useMemo, useState } from "react";
import type { BoardDrilldownRow } from "@/lib/server/odds/types";
import { ConfidencePill } from "@/components/board/ConfidencePill";
import styles from "./BoardWorkspace.module.css";

function formatAmerican(price: number): string {
  if (!Number.isFinite(price)) return "--";
  return price > 0 ? `+${Math.round(price)}` : `${Math.round(price)}`;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "--";
  return `${(value * 100).toFixed(2)}%`;
}

function formatValue(value: number): string {
  if (!Number.isFinite(value)) return "$0.00";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}$${value.toFixed(2)}`;
}

function formatGap(value: number): string {
  if (!Number.isFinite(value)) return "--";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}pp`;
}

function formatStartTime(iso: string, isLive: boolean): string {
  if (isLive) return "Live";
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "Start time unavailable";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(ts));
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
  if (position === "above_market") return "Above market";
  if (position === "below_market") return "Below market";
  return "At market";
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
  const toggleLabel = expanded ? "Hide" : "View";
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

  const detailContent = (
    <div className={styles.detailContent}>
      <div className={styles.detailMetrics}>
        <div className={styles.detailMetric}>
          <span className={styles.detailMetricLabel}>Fair Line</span>
          <strong className={styles.detailMetricValue}>{formatAmerican(row.expanded.weightedMarketFairOdds)}</strong>
        </div>
        <div className={styles.detailMetric}>
          <span className={styles.detailMetricLabel}>Fair Probability</span>
          <strong className={styles.detailMetricValue}>{formatPercent(row.expanded.weightedMarketFairProbability)}</strong>
        </div>
        <div className={styles.detailMetric}>
          <span className={styles.detailMetricLabel}>Best Book</span>
          <strong className={styles.detailMetricValue}>{row.bestBook}</strong>
        </div>
        <div className={styles.detailMetric}>
          <span className={styles.detailMetricLabel}>Consensus</span>
          <strong className={styles.detailMetricValue}>{row.booksInConsensus} books</strong>
        </div>
        <div className={styles.detailMetric}>
          <span className={styles.detailMetricLabel}>Total Weight</span>
          <strong className={styles.detailMetricValue}>{row.expanded.totalWeight.toFixed(2)}</strong>
        </div>
        <div className={styles.detailMetric}>
          <span className={styles.detailMetricLabel}>Signal</span>
          <strong className={styles.detailMetricValue}>{signalLabel(bestGap)}</strong>
        </div>
      </div>

      <div className={styles.detailTableWrap}>
        <table className={styles.detailTable}>
          <thead>
            <tr>
              <th>Book</th>
              <th>Odds</th>
              <th>No-vig</th>
              <th>Gap</th>
              <th>Value</th>
              <th>Position</th>
            </tr>
          </thead>
          <tbody>
            {sortedOffers.map((offer) => (
              <tr key={`${row.id}:${offer.book}`}>
                <td>{offer.book}</td>
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

      <p className={styles.detailNote}>
        Fair probability is derived after per-book vig removal and weighted market aggregation.
      </p>
    </div>
  );

  if (variant === "card") {
    return (
      <article className={styles.mobileCard}>
        <div className={styles.mobileTop}>
          <div className={styles.eventCell}>
            <strong>{row.event}</strong>
            <span className={styles.eventMeta}>{formatStartTime(row.commenceTime, row.isLive)}</span>
          </div>
          <span className={styles.rowStatus}>{row.isLive ? "Live" : "Upcoming"}</span>
        </div>

        <p className={styles.mobileMarket}>{row.market}</p>

        <div className={styles.mobileMetrics}>
          <div className={styles.mobileMetric}>
            <span>Best</span>
            <strong>
              {formatAmerican(row.bestOdds)} @ {row.bestBook}
            </strong>
          </div>
          <div className={styles.mobileMetric}>
            <span>Fair</span>
            <strong>{formatAmerican(row.marketFairOdds)}</strong>
          </div>
          <div className={styles.mobileMetric}>
            <span>Gap</span>
            <strong className={gapTone(bestGap)}>{formatGap(bestGap)}</strong>
          </div>
          <div className={styles.mobileMetric}>
            <span>Value</span>
            <strong className={valueTone(row.valuePer100)}>{`${formatValue(row.valuePer100)} / $100`}</strong>
          </div>
        </div>

        <div className={styles.mobileMetaRow}>
          {row.confidenceLabel ? <ConfidencePill label={row.confidenceLabel} /> : <span />}
          <span className={styles.coverageMeta}>{coverageStatus}</span>
          <button
            type="button"
            className={styles.detailToggle}
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls={detailId}
          >
            {toggleLabel}
          </button>
        </div>

        {expanded ? <div id={detailId}>{detailContent}</div> : null}
      </article>
    );
  }

  return (
    <>
      <tr className={styles.tableRow}>
        <td>
          <div className={styles.eventCell}>
            <strong>{row.event}</strong>
            <span className={styles.eventMeta}>{formatStartTime(row.commenceTime, row.isLive)}</span>
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
            <span>{row.bestBook}</span>
          </div>
        </td>
        <td>
          <div className={styles.priceCluster}>
            <strong className={styles.priceValue}>{formatAmerican(row.marketFairOdds)}</strong>
            <span>Model fair</span>
          </div>
        </td>
        <td>
          <strong className={`${styles.gapValue} ${gapTone(bestGap)}`}>{formatGap(bestGap)}</strong>
        </td>
        <td>
          <div className={styles.valueCell}>
            <strong className={valueTone(row.valuePer100)}>{`${formatValue(row.valuePer100)} / $100`}</strong>
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
          <td colSpan={8}>{detailContent}</td>
        </tr>
      ) : null}
    </>
  );
}

export const BoardRow = memo(BoardRowComponent);
