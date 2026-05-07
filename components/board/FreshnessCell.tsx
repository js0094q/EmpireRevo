import { Badge } from "@/components/primitives/Badge";
import styles from "./workstation.module.css";

export function FreshnessCell({ updated, isStale }: { updated: string; isStale: boolean }) {
  if (!isStale) return <Badge tone="neutral">{updated}</Badge>;
  return (
    <span className={styles.freshnessStack}>
      <Badge tone="warning">Stale</Badge>
      <span className={styles.booksMeta}>{updated}</span>
    </span>
  );
}
