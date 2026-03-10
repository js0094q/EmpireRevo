import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/ui/cn";
import styles from "./ui.module.css";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(styles.field, className)} {...props} />;
}
