import { Panel } from "@/components/primitives/Panel";
import { Sparkline, type ChartSeries } from "@/components/board/Sparkline";
import type { GameDetailPageData } from "@/lib/server/odds/gameDetailPageData";
import type { GameDetailViewModel } from "@/lib/ui/view-models/gameDetailViewModel";
import styles from "./detail.module.css";

function buildSeries(data: GameDetailPageData): ChartSeries[] {
  if (!data.timeline) return [];
  const fairPoints = data.timeline.points
    .filter((point) => Number.isFinite(point.fairAmerican))
    .map((point) => ({ ts: point.ts, priceAmerican: Number(point.fairAmerican) }));
  const bestPoints = data.timeline.points
    .filter((point) => Number.isFinite(point.globalBestAmerican))
    .map((point) => ({ ts: point.ts, priceAmerican: Number(point.globalBestAmerican) }));
  const pinnedPoints = data.timeline.points
    .filter((point) => Number.isFinite(point.pinnedBestAmerican))
    .map((point) => ({ ts: point.ts, priceAmerican: Number(point.pinnedBestAmerican) }));
  return [
    fairPoints.length >= 2
      ? {
      id: "fair",
      label: "Fair",
      color: "#4f8cff",
      points: fairPoints
        }
      : null,
    bestPoints.length >= 2
      ? {
          id: "best",
          label: "Best price",
          color: "#7ce3bf",
          points: bestPoints
        }
      : null,
    pinnedPoints.length >= 2
      ? {
          id: "pinned",
          label: "Pinned best",
          color: "#f2c879",
          points: pinnedPoints
        }
      : null
  ].filter((series): series is ChartSeries => Boolean(series));
}

export function MarketHistoryPanel({
  viewModel,
  data
}: {
  viewModel: GameDetailViewModel["history"];
  data: GameDetailPageData;
}) {
  return (
    <Panel>
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>History</h2>
        {viewModel.available ? (
          <>
            <div className={styles.historyStats} aria-label="Persisted market history summary">
              <span>
                <small>Timeline points</small>
                <strong>{viewModel.points}</strong>
              </span>
              <span>
                <small>Book observations</small>
                <strong>{data.timeline?.books.length ?? 0}</strong>
              </span>
              <span>
                <small>Line movement</small>
                <strong>{data.timeline?.points.some((point) => Number.isFinite(point.globalBestAmerican)) ? "Observed" : "Pending"}</strong>
              </span>
              <span>
                <small>CLV</small>
                <strong>{data.closingEvaluation ? "Available" : "Pending outcome"}</strong>
              </span>
            </div>
            <div className={styles.historyMeta}>
              <span className={styles.meta}>Updated {viewModel.updated}</span>
              <span className={styles.meta}>Pressure {viewModel.pressure}</span>
              <span className={styles.meta}>Value {viewModel.valuePersistence}</span>
              <span className={styles.meta}>Trend {viewModel.edgeTrend}</span>
            </div>
            <Sparkline series={buildSeries(data)} compact={false} />
            <div className={styles.historyLegend}>
              {buildSeries(data).map((series) => (
                <span key={series.id}>
                  <i style={{ background: series.color }} />
                  {series.label}
                </span>
              ))}
            </div>
            <p className={styles.note}>{viewModel.pressureExplanation}</p>
          </>
        ) : (
          <p className={styles.note}>No persisted history for this market yet.</p>
        )}
      </div>
    </Panel>
  );
}
