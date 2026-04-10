import type { ButtonHTMLAttributes } from "react";
import styles from "./primitives.module.css";
import { cn } from "@/lib/ui/cn";

export function Button({
  className,
  variant = "default",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "ghost";
}) {
  return (
    <button
      className={cn(
        styles.button,
        variant === "primary" && styles.buttonPrimary,
        variant === "ghost" && styles.buttonGhost,
        className
      )}
      {...props}
    />
  );
}
