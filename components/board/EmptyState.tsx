import { Button } from "@/components/ui/Button";
import styles from "./BoardWorkspace.module.css";

type BoardEmptyStateProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, message, actionLabel, onAction }: BoardEmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      <h2 className={styles.emptyTitle}>{title}</h2>
      <p className={styles.emptyCopy}>{message}</p>
      {actionLabel && onAction ? (
        <div className={styles.emptyActions}>
          <Button onClick={onAction}>{actionLabel}</Button>
        </div>
      ) : null}
    </div>
  );
}
