import type { HTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";
import styles from "./ui.module.css";

export function Skeleton({ className, style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(styles.skeleton, className)} style={style} {...props} />;
}
