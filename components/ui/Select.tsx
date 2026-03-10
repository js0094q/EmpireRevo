import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";
import styles from "./ui.module.css";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(styles.select, className)} {...props} />;
}
