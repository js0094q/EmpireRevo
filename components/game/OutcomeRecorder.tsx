"use client";

import { useState, useTransition } from "react";
import { trackProductEvent } from "@/components/analytics/ProductAnalytics";
import { Badge } from "@/components/primitives/Badge";
import { Button } from "@/components/primitives/Button";
import { Input } from "@/components/primitives/Input";
import { Select } from "@/components/primitives/Select";
import type { GameDetailViewModel } from "@/lib/ui/view-models/gameDetailViewModel";
import styles from "./detail.module.css";

type OutcomeViewModel = GameDetailViewModel["outcome"];

export function OutcomeRecorder({ outcome }: { outcome: OutcomeViewModel }) {
  const [result, setResult] = useState(outcome.result || "unknown");
  const [finalScore, setFinalScore] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/internal/outcomes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          ...outcome.identifiers,
          result,
          finalScore
        })
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null;
      if (!response.ok || !payload?.ok) {
        setMessage(payload?.error?.message || "Outcome update failed.");
        return;
      }
      trackProductEvent(outcome.result ? "outcome_updated" : "pick_recorded", {
        result,
        market: outcome.identifiers.marketKey,
        sport: outcome.identifiers.sportKey
      });
      trackProductEvent("outcome_updated", {
        result,
        market: outcome.identifiers.marketKey,
        sport: outcome.identifiers.sportKey
      });
      setMessage("Outcome saved. Refresh to update realized ROI.");
    });
  }

  return (
    <div className={styles.outcomeRecorder}>
      <div className={styles.outcomeHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Outcome Recording</h2>
          <p className={styles.note}>Internal flat 1-unit settlement workflow.</p>
        </div>
        <Badge tone={outcome.tone}>{outcome.label}</Badge>
      </div>

      <div className={styles.resultGrid}>
        <div>
          <span className={styles.summaryLabel}>Recorded Price</span>
          <strong className={styles.summaryValue}>{outcome.recordedPrice}</strong>
        </div>
        <div>
          <span className={styles.summaryLabel}>Recorded EV</span>
          <strong className={styles.summaryValue}>{outcome.recordedEv}</strong>
        </div>
        <div>
          <span className={styles.summaryLabel}>Recorded</span>
          <strong>{outcome.recordedAt}</strong>
        </div>
        <div>
          <span className={styles.summaryLabel}>Settled</span>
          <strong>{outcome.settledAt}</strong>
        </div>
        <div>
          <span className={styles.summaryLabel}>P/L</span>
          <strong className={styles.summaryValue}>{outcome.profitLossUnits}</strong>
        </div>
        <div>
          <span className={styles.summaryLabel}>ROI</span>
          <strong className={styles.summaryValue}>{outcome.roiPercent}</strong>
        </div>
      </div>

      {outcome.canRecord ? (
        <div className={styles.recordForm}>
          <label>
            <span className={styles.summaryLabel}>Outcome</span>
            <Select value={result} onChange={(event) => setResult(event.target.value as typeof result)}>
              <option value="win">Win</option>
              <option value="loss">Loss</option>
              <option value="push">Push</option>
              <option value="void">Void</option>
              <option value="unknown">Unknown</option>
            </Select>
          </label>
          <label>
            <span className={styles.summaryLabel}>Final Score</span>
            <Input value={finalScore} onChange={(event) => setFinalScore(event.target.value)} placeholder="Optional" />
          </label>
          <Button type="button" variant="primary" disabled={isPending} onClick={submit}>
            {isPending ? "Saving" : "Save outcome"}
          </Button>
        </div>
      ) : null}
      {message ? <p className={styles.note}>{message}</p> : null}
    </div>
  );
}
