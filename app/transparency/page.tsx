import type { Metadata } from "next";
import { TrackedLink } from "@/components/analytics/TrackedLink";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Transparency and Record Methodology",
  description:
    "How EmpirePicks treats fair odds, CLV, ROI, units, sample size, stale markets, and public performance claims."
};

const metrics = [
  {
    label: "Fair line",
    value: "No-vig consensus",
    note: "Posted odds are converted to implied probability, normalized for sportsbook margin, and weighted by book profile."
  },
  {
    label: "CLV",
    value: "Implied-probability space",
    note: "Closing-line value is evaluated against self-collected market history when a close snapshot exists."
  },
  {
    label: "ROI",
    value: "Flat unit stake",
    note: "ROI is computed only for validation events with matching persisted outcomes. Missing outcomes stay excluded."
  }
];

export default function TransparencyPage() {
  return (
    <main className={styles.legalPage}>
      <h1 className={styles.legalTitle}>Transparency and methodology</h1>
      <p className={styles.legalLead}>
        EmpirePicks should be judged by reproducible pricing logic, clear limitations, and auditable records. The public
        product does not fabricate outcomes, ROI, CLV, or confidence signals.
      </p>
      <div className={styles.ctaRow}>
        <TrackedLink
          href="/"
          className={styles.primaryCta}
          eventName="board_open"
          eventProperties={{ placement: "transparency_hero" }}
        >
          Open live board
        </TrackedLink>
        <TrackedLink
          href="/pricing"
          className={styles.secondaryCta}
          eventName="pricing_cta"
          eventProperties={{ placement: "transparency_hero" }}
        >
          View launch access
        </TrackedLink>
      </div>

      <section className={styles.metricGrid} aria-label="Core transparency metrics">
        {metrics.map((metric) => (
          <article key={metric.label} className={styles.metricCard}>
            <span className={styles.legalMeta}>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.note}</p>
          </article>
        ))}
      </section>

      <section className={styles.legalSection}>
        <h2>What is tracked</h2>
        <ul className={styles.legalList}>
          <li>Recommendation-time fair probability, fair American odds, displayed book, and displayed price.</li>
          <li>Market history snapshots when durable persistence is configured.</li>
          <li>Closing-line comparisons when a matching close reference exists.</li>
          <li>Outcome-linked ROI only after persisted win, loss, push, or void records exist.</li>
        </ul>
      </section>

      <section className={styles.legalSection}>
        <h2>What is not claimed</h2>
        <ul className={styles.legalList}>
          <li>No fabricated historical returns.</li>
          <li>No inferred wins or losses when outcome data is missing.</li>
          <li>No guarantee that positive expected value produces short-run profit.</li>
          <li>No public ROI claim until the underlying sample is reproducible and large enough to review.</li>
        </ul>
      </section>

      <section className={styles.legalSection}>
        <h2>Record-tracking launch requirement</h2>
        <p>
          Before a public record page publishes ROI, units won, win rate, or CLV, it should include sample size,
          settled sample size, sport and market filters, push/void/unknown counts, and the active closing-line reference.
        </p>
      </section>
    </main>
  );
}
