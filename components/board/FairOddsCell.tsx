import type { FairEvent, FairOutcome } from "@/lib/server/odds/types";
import styles from "./BoardShell.module.css";
import { formatOffer } from "@/components/board/board-helpers";

export function FairOddsCell({ event, outcome }: { event: FairEvent; outcome: FairOutcome }) {
  return (
    <div className={styles.fairCell}>
      <span className={styles.cellLabel}>Fair Value</span>
      <span className={styles.cellValue}>{formatOffer(event.market, outcome)}</span>
      <span className={styles.subtle}>{`${(outcome.fairProb * 100).toFixed(2)}% fair probability`}</span>
    </div>
  );
}
