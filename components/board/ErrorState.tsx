import type { ReactNode } from "react";
import { AppContainer } from "@/components/layout/AppContainer";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/Button";
import styles from "./BoardShell.module.css";

type BoardErrorStateProps = {
  title: string;
  message?: string;
  hint?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
};

export function ErrorState({ title, message, hint, actionLabel, onAction }: BoardErrorStateProps) {
  return (
    <div className={styles.stateShell}>
      <AppContainer>
        <AppHeader eyebrow="EmpirePicks" title={title} subtitle={message || "Unable to build the board."} />
        <section className={styles.stateCard}>
          {hint ? <div className={styles.stateText}>{hint}</div> : null}
          {actionLabel ? (
            <div className={styles.stateActions}>
              <Button variant="primary" onClick={onAction}>
                {actionLabel}
              </Button>
            </div>
          ) : null}
        </section>
      </AppContainer>
    </div>
  );
}
