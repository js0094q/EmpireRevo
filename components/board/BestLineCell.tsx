import styles from "./workstation.module.css";

export function BestLineCell({
  bestPrice,
  pinnedPrice
}: {
  bestPrice: string;
  pinnedPrice: string | null;
}) {
  return (
    <div className={styles.lineCell}>
      <span className={styles.numeric}>{bestPrice}</span>
      {pinnedPrice ? <span className={styles.cellMeta}>Pinned {pinnedPrice}</span> : null}
    </div>
  );
}
