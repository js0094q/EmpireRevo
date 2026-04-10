import type { ReactNode } from "react";
import styles from "./primitives.module.css";
import { Panel } from "@/components/primitives/Panel";

export function ErrorState({
  title,
  message,
  detail,
  actions
}: {
  title: string;
  message: string;
  detail?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Panel>
      <div className={styles.state}>
        <h2 className={styles.stateTitle}>{title}</h2>
        <p className={styles.stateMessage}>{message}</p>
        {detail ? <div className={styles.stateMessage}>{detail}</div> : null}
        {actions ? <div className={styles.stateActions}>{actions}</div> : null}
      </div>
    </Panel>
  );
}
