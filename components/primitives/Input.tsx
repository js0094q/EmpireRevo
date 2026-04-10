import type { InputHTMLAttributes } from "react";
import styles from "./primitives.module.css";
import { cn } from "@/lib/ui/cn";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(styles.field, props.className)} />;
}
