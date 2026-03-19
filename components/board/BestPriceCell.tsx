import type { FairEvent, FairOutcome } from "@/lib/server/odds/types";
import styles from "./BoardShell.module.css";
import { bestPriceBook, formatOffer } from "@/components/board/board-helpers";
import { Pill } from "@/components/ui/Pill";

export function BestPriceCell({ event, outcome }: { event: FairEvent; outcome: FairOutcome }) {
  const bestBook = bestPriceBook(outcome);

  return (
    <div className={styles.priceCell}>
      <span className={styles.cellLabel}>Best Line</span>
      <span className={styles.cellValue}>{bestBook ? formatOffer(event.market, bestBook) : "--"}</span>
      <div className={styles.metaLine}>
        <Pill tone="accent">{outcome.name}</Pill>
        {bestBook ? <span className={styles.priceMeta}>{bestBook.title}</span> : null}
      </div>
    </div>
  );
}
