import type { HTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";
import styles from "./ui.module.css";

type PillProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "positive" | "warning" | "danger" | "accent";
};

export function Pill({ className, tone = "neutral", ...props }: PillProps) {
  return (
    <span
      className={cn(
        styles.pill,
        tone === "positive" && styles.pillPositive,
        tone === "warning" && styles.pillWarning,
        tone === "danger" && styles.pillDanger,
        tone === "accent" && styles.pillAccent,
        className
      )}
      {...props}
    />
  );
}
