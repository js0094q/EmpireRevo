import { Button } from "@/components/ui/Button";
import styles from "./BoardShell.module.css";

type BoardEmptyStateProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, message, actionLabel, onAction }: BoardEmptyStateProps) {
  return (
    <div className={styles.emptyCard}>
      <h2>{title}</h2>
      <p className={styles.stateText}>{message}</p>
      {actionLabel && onAction ? (
        <div className={styles.stateActions}>
          <Button onClick={onAction}>{actionLabel}</Button>
        </div>
      ) : null}
    </div>
  );
}
