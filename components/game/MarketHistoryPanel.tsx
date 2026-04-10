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
  if (fairPoints.length < 2) return [];
  return [
    {
      id: "fair",
      label: "Fair",
      color: "#4f8cff",
      points: fairPoints
    }
  ];
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
            <div className={styles.historyMeta}>
              <span className={styles.meta}>Updated {viewModel.updated}</span>
              <span className={styles.meta}>Pressure {viewModel.pressure}</span>
              <span className={styles.meta}>Value {viewModel.valuePersistence}</span>
              <span className={styles.meta}>Trend {viewModel.edgeTrend}</span>
            </div>
            <Sparkline series={buildSeries(data)} compact={false} />
            <div className={styles.historyLegend}>
              <span>
                <i />
                Fair
              </span>
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
