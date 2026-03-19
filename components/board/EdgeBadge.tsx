import { Pill } from "@/components/ui/Pill";
import styles from "./BoardShell.module.css";
import { cn } from "@/lib/ui/cn";

export type EdgeTier = "strong" | "moderate" | "weak";

export function getEdgeTier(edge: number): EdgeTier {
  if (edge >= 1.5) return "strong";
  if (edge >= 0.75) return "moderate";
  return "weak";
}

export function getEdgeTierLabel(edge: number): "Strong Value" | "Moderate" | "Marginal" {
  const tier = getEdgeTier(edge);
  if (tier === "strong") return "Strong Value";
  if (tier === "moderate") return "Moderate";
  return "Marginal";
}

export function EdgeBadge({
  edgePct,
  size = "md",
  showTierLabel = false
}: {
  edgePct: number;
  size?: "md" | "lg";
  showTierLabel?: boolean;
}) {
  const tier = getEdgeTier(edgePct);
  const tone = edgePct < 0 ? "danger" : tier === "weak" ? "neutral" : "positive";
  const prefix = edgePct > 0 ? "+" : "";

  return (
    <Pill
      tone={tone}
      className={cn(
        styles.edgeBadge,
        size === "lg" && styles.edgeBadgeLg,
        tier === "strong" && styles.edgeBadgeStrong,
        tier === "moderate" && styles.edgeBadgeModerate,
        tier === "weak" && styles.edgeBadgeWeak,
        edgePct > 0 && styles.edgeBadgePositive,
        edgePct < 0 && styles.edgeBadgeNegative
      )}
    >
      {`Edge ${prefix}${edgePct.toFixed(2)}%`}
      {showTierLabel ? <span className={styles.edgeBadgeTier}>{getEdgeTierLabel(edgePct)}</span> : null}
    </Pill>
  );
}
