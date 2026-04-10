import type { ReactNode } from "react";
import styles from "./primitives.module.css";
import { Panel } from "@/components/primitives/Panel";

export function EmptyState({ title, message, actions }: { title: string; message: string; actions?: ReactNode }) {
  return (
    <Panel>
      <div className={styles.state}>
        <h2 className={styles.stateTitle}>{title}</h2>
        <p className={styles.stateMessage}>{message}</p>
        {actions ? <div className={styles.stateActions}>{actions}</div> : null}
      </div>
    </Panel>
  );
}
