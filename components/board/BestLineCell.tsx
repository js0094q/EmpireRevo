import styles from "./workstation.module.css";

export function BestLineCell({
  bestPrice,
  book,
  pinnedPrice
}: {
  bestPrice: string;
  book: string;
  pinnedPrice: string | null;
}) {
  return (
    <div className={styles.lineCell}>
      <span className={styles.numeric}>{bestPrice}</span>
      <span className={styles.cellMeta}>{book}</span>
      {pinnedPrice ? <span className={styles.cellMeta}>Pinned {pinnedPrice}</span> : null}
    </div>
  );
}
