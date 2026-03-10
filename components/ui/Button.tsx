import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";
import styles from "./ui.module.css";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "subtle";
  active?: boolean;
};

export function Button({ className, variant = "subtle", active = false, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        styles.button,
        variant === "primary" && styles.buttonPrimary,
        variant === "ghost" && styles.buttonGhost,
        variant === "subtle" && styles.buttonSubtle,
        active && styles.buttonActive,
        className
      )}
      {...props}
    />
  );
}
