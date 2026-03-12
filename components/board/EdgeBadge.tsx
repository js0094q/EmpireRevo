import { Pill } from "@/components/ui/Pill";
import { edgeTone } from "@/components/board/board-helpers";
import styles from "./BoardShell.module.css";
import { cn } from "@/lib/ui/cn";

export function EdgeBadge({ edgePct, size = "md" }: { edgePct: number; size?: "md" | "lg" }) {
  const tone = edgeTone(edgePct);
  const prefix = edgePct > 0 ? "+" : "";

  return (
    <Pill
      tone={tone}
      className={cn(
        styles.edgeBadge,
        size === "lg" && styles.edgeBadgeLg,
        edgePct > 0 && styles.edgeBadgePositive,
        edgePct < 0 && styles.edgeBadgeNegative
      )}
    >
      {`Edge ${prefix}${edgePct.toFixed(2)}%`}
    </Pill>
  );
}
