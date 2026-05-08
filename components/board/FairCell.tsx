import styles from "./workstation.module.css";

export function FairCell({ fairPrice, meta }: { fairPrice: string; meta?: string | null }) {
  return (
    <div className={styles.lineCell}>
      <span className={styles.numeric}>{fairPrice}</span>
      {meta ? <span className={styles.cellMeta}>{meta}</span> : null}
    </div>
  );
}
