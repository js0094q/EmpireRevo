import type { ReactNode } from "react";
import { cn } from "@/lib/ui/cn";
import styles from "./ui.module.css";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
};

export function Drawer({ open, onClose, children, className }: DrawerProps) {
  if (!open) return null;

  return (
    <>
      <button className={styles.drawerOverlay} aria-label="Close details" onClick={onClose} />
      <aside className={cn(styles.drawer, className)} aria-modal="true" role="dialog">
        <div className={styles.drawerInner}>{children}</div>
      </aside>
    </>
  );
}
