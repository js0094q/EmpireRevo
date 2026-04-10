import type { SelectHTMLAttributes } from "react";
import styles from "./primitives.module.css";
import { cn } from "@/lib/ui/cn";

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(styles.select, props.className)} />;
}
