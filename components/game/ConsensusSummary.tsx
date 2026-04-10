import { Panel } from "@/components/primitives/Panel";
import type { GameDetailViewModel } from "@/lib/ui/view-models/gameDetailViewModel";
import styles from "./detail.module.css";

export function ConsensusSummary({ summary }: { summary: GameDetailViewModel["summary"] }) {
  return (
    <Panel>
      <div className={styles.summaryGrid}>
        {summary.map((item) => (
          <div key={item.label} className={styles.summaryItem}>
            <span className={styles.summaryLabel}>{item.label}</span>
            <strong className={styles.summaryValue}>{item.value}</strong>
          </div>
        ))}
      </div>
    </Panel>
  );
}
