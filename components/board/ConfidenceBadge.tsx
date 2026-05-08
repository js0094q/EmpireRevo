import { Badge } from "@/components/primitives/Badge";
import styles from "./workstation.module.css";

export function ConfidenceBadge({
  label,
  bucket,
  isStale,
  detail
}: {
  label: string;
  bucket: "high" | "medium" | "low";
  isStale: boolean;
  detail?: string | null;
}) {
  const tone = isStale ? "warning" : bucket === "high" ? "positive" : "neutral";
  return (
    <Badge tone={tone} className={styles.confidenceBadge} title={detail || undefined}>
      {label}
    </Badge>
  );
}
