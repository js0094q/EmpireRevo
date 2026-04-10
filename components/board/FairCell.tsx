import styles from "./workstation.module.css";

export function FairCell({ fairPrice }: { fairPrice: string }) {
  return <span className={styles.numeric}>{fairPrice}</span>;
}
