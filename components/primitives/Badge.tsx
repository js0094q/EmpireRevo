import type { ReactNode } from "react";
import styles from "./primitives.module.css";
import { cn } from "@/lib/ui/cn";

export function Badge({
  children,
  tone = "neutral",
  className
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "warning" | "danger" | "accent";
  className?: string;
}) {
  return (
    <span
      className={cn(
        styles.badge,
        tone === "positive" && styles.badgePositive,
        tone === "warning" && styles.badgeWarning,
        tone === "danger" && styles.badgeDanger,
        tone === "accent" && styles.badgeAccent,
        tone === "neutral" && styles.badgeNeutral,
        className
      )}
    >
      {children}
    </span>
  );
}
