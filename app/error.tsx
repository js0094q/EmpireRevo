"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/primitives/ErrorState";
import { Button } from "@/components/primitives/Button";
import styles from "@/components/primitives/primitives.module.css";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error(error);
    }
  }, [error]);

  return (
    <ErrorState
      title="Something went wrong"
      message="EmpirePicks could not complete this request right now."
      detail="Please retry. If this continues, check system health or come back in a moment."
      actions={
        <div style={{ display: "grid", gap: "0.55rem", gridTemplateColumns: "repeat(auto-fit,minmax(120px, 1fr))" }}>
          <Button type="button" onClick={reset} variant="primary">
            Try again
          </Button>
          <Link href="/" className={`${styles.button} ${styles.buttonPrimary}`}>
            Back to board
          </Link>
          <a href="/api/health" target="_blank" rel="noreferrer" className={styles.button}>
            View health endpoint
          </a>
        </div>
      }
    />
  );
}
