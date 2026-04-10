import styles from "./workstation.module.css";

export function BooksCell({ value, meta }: { value: string; meta?: string | null }) {
  return (
    <div className={styles.statusCell}>
      <span>{value}</span>
      {meta ? <span className={styles.booksMeta}>{meta}</span> : null}
    </div>
  );
}
