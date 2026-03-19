import type { FairEvent, FairOutcome } from "@/lib/server/odds/types";
import styles from "./BoardShell.module.css";
import { bestPriceBook, formatOffer } from "@/components/board/board-helpers";
import { Pill } from "@/components/ui/Pill";

export function BestPriceCell({ event, outcome }: { event: FairEvent; outcome: FairOutcome }) {
  const bestBook = bestPriceBook(outcome);

  return (
    <div className={styles.priceCell}>
      <span className={styles.cellValue}>{bestBook ? formatOffer(event.market, bestBook) : "--"}</span>
      <div className={styles.metaLine}>
        <span className={styles.priceMeta}>{outcome.name}</span>
        {bestBook ? <Pill tone="accent">{bestBook.title}</Pill> : null}
      </div>
    </div>
  );
}
