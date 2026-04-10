import styles from "./primitives.module.css";
import { cn } from "@/lib/ui/cn";

export function Skeleton({ className, height = 16 }: { className?: string; height?: number }) {
  return <div className={cn(styles.skeleton, className)} style={{ height }} aria-hidden="true" />;
}
