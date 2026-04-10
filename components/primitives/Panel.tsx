import type { HTMLAttributes, ReactNode } from "react";
import styles from "./primitives.module.css";
import { cn } from "@/lib/ui/cn";

export function Panel({
  children,
  padded = true,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  padded?: boolean;
}) {
  return <div {...props} className={cn(styles.panel, padded && styles.panelPadding, className)}>{children}</div>;
}
