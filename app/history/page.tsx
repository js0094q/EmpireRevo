import type { Metadata } from "next";
import { LeadCapture } from "@/components/lead/LeadCapture";
import { TrackedLink } from "@/components/analytics/TrackedLink";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Public Record Methodology",
  description:
    "EmpirePicks public record methodology for wins, losses, pushes, ROI, units, CLV, sample size, and audit readiness."
};

const readinessRows = [
  {
    label: "Recommendation log",
    status: "Tracked internally",
    note: "Validation events preserve recommendation-time fair probability, displayed price, book, market, and side."
  },
  {
    label: "Outcome matching",
    status: "Sample-gated",
    note: "Wins, losses, pushes, and voids must be persisted before ROI or units can be published."
  },
  {
    label: "CLV",
    status: "History-gated",
    note: "Closing-line value requires a matching self-collected close snapshot and explicit close reference."
  }
];

export default function HistoryPage() {
  return (
    <main className={styles.legalPage}>
      <h1 className={styles.legalTitle}>Public record methodology</h1>
      <p className={styles.legalLead}>
        EmpirePicks will not publish a win rate, ROI, units-won figure, or CLV result until the underlying event sample
        can be audited. This page is the public contract for how that record will be shown.
      </p>
      <div className={styles.ctaRow}>
        <LeadCapture
          triggerLabel="Get record updates"
          title="Request public record updates"
          intent="launch_access"
          variant="primary"
          placement="history_hero"
        />
        <TrackedLink
          href="/transparency"
          className={styles.secondaryCta}
          eventName="transparency_cta"
          eventProperties={{ placement: "history_hero" }}
        >
          Review methodology
        </TrackedLink>
      </div>

      <section className={styles.metricGrid} aria-label="Record readiness">
        {readinessRows.map((row) => (
          <article key={row.label} className={styles.metricCard}>
            <span className={styles.legalMeta}>{row.label}</span>
            <strong>{row.status}</strong>
            <p>{row.note}</p>
          </article>
        ))}
      </section>

      <section className={styles.legalSection}>
        <h2>Published record requirements</h2>
        <ul className={styles.legalList}>
          <li>Every row must map to a recommendation-time event, market, side, book, displayed price, and fair line.</li>
          <li>ROI and units must disclose settled sample size and exclude unknown outcomes.</li>
          <li>CLV must state the active close reference and use implied-probability deltas.</li>
          <li>Filters must include sport, market, date range, book, result, CLV, and edge where data exists.</li>
        </ul>
      </section>
    </main>
  );
}
