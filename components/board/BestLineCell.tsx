import styles from "./workstation.module.css";

export function BestLineCell({
  bestPrice,
  meta,
  pinnedPrice
}: {
  bestPrice: string;
  meta?: string | null;
  pinnedPrice: string | null;
}) {
  return (
    <div className={styles.lineCell}>
      <span className={styles.numeric}>{bestPrice}</span>
      {meta ? <span className={styles.cellMeta}>{meta}</span> : null}
      {pinnedPrice ? <span className={styles.cellMeta}>Pinned {pinnedPrice}</span> : null}
    </div>
  );
}
