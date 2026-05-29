"use client";

import { useId, useState } from "react";
import { track } from "@vercel/analytics";
import styles from "./LeadCapture.module.css";
import { cn } from "@/lib/ui/cn";

type LeadCaptureProps = {
  triggerLabel: string;
  title: string;
  intent: string;
  resource?: string;
  resourceHref?: string;
  variant?: "primary" | "secondary";
  placement: string;
};

type SubmitState = "idle" | "submitting" | "success" | "error";

export function LeadCapture({
  triggerLabel,
  title,
  intent,
  resource,
  resourceHref,
  variant = "primary",
  placement
}: LeadCaptureProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [status, setStatus] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");
  const titleId = useId();
  const descriptionId = useId();

  function openModal() {
    track("modal_open", { placement, intent, resource: resource || "none" });
    setOpen(true);
    setStatus("idle");
    setMessage("");
  }

  async function submitLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, zipCode, intent, resource, placement })
      });
      const payload = (await response.json()) as { ok?: boolean; captured?: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "Lead request failed.");
      }

      track("lead_submit", { placement, intent, resource: resource || "none", captured: Boolean(payload.captured) });
      if (resourceHref) {
        track("article_download", { placement, resource: resource || resourceHref });
      }
      setStatus("success");
      setMessage(
        payload.captured
          ? "Request received. Launch access follow-up will use the email provided."
          : "Request prepared. Email support is still the fallback until lead capture is configured."
      );
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to submit right now.");
    }
  }

  return (
    <>
      <button
        type="button"
        className={cn(styles.trigger, variant === "secondary" && styles.triggerSecondary)}
        onClick={openModal}
      >
        {triggerLabel}
      </button>

      {open ? (
        <div className={styles.backdrop} role="presentation">
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
          >
            <div className={styles.dialogHeader}>
              <div>
                <h2 id={titleId} className={styles.dialogTitle}>
                  {title}
                </h2>
                <p id={descriptionId} className={styles.dialogCopy}>
                  Enter email and ZIP code so launch access can be routed by market availability and product fit.
                </p>
              </div>
              <button type="button" className={styles.closeButton} onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            <form className={styles.form} onSubmit={submitLead}>
              <label className={styles.field}>
                <span className={styles.label}>Email</span>
                <input
                  className={styles.input}
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>ZIP code</span>
                <input
                  className={styles.input}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  pattern="[0-9]{5}"
                  placeholder="5 digits"
                  required
                  value={zipCode}
                  onChange={(event) => setZipCode(event.target.value)}
                />
              </label>
              <button type="submit" className={styles.submit} disabled={status === "submitting"}>
                {status === "submitting" ? "Submitting..." : "Submit"}
              </button>
            </form>

            {message ? <p className={styles.statusText}>{message}</p> : null}
            {status === "success" && resourceHref ? (
              <a className={styles.resourceLink} href={resourceHref}>
                Open requested resource
              </a>
            ) : null}
            {status === "success" ? (
              <a className={styles.resourceLink} href="mailto:support@empirepicks.app?subject=EmpirePicks%20launch%20access">
                Email support fallback
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
