import type { Metadata } from "next";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "About EmpirePicks",
  description: "Learn how EmpirePicks helps bettors compare sportsbook pricing with fair-line and confidence context."
};

export default function AboutPage() {
  return (
    <main className={styles.legalPage}>
      <h1 className={styles.legalTitle}>About EmpirePicks</h1>
      <p className={styles.legalLead}>
        EmpirePicks is a commercial-grade betting intelligence dashboard focused on fast, understandable market decisions.
      </p>
      <p className={styles.legalMeta}>Last updated: May 27, 2026</p>

      <section className={styles.legalSection}>
        <h2>What we built</h2>
        <p>
          The platform combines live prices, no-vig normalization, weighted fair-line modeling, confidence signals, and market movement into a table-first board.
          It is designed so you can identify actionable opportunities quickly without wading through spreadsheet-like detail.
        </p>
      </section>

      <section className={styles.legalSection}>
        <h2>Who this is for</h2>
        <ul className={styles.legalList}>
          <li>Recreational users who want quick, high-signal market comparisons.</li>
          <li>Advanced bettors who want market-control filters and diagnostics.</li>
          <li>Professionals who care about persistence, latency, and explainability.</li>
        </ul>
      </section>

      <section className={styles.legalSection}>
        <h2>What makes it launch-ready</h2>
        <ul className={styles.legalList}>
          <li>Rate limiting and input validation on public and internal surfaces.</li>
          <li>Security boundaries for internal tools and raw data access.</li>
          <li>Production observability with health, validation, and retention checks.</li>
          <li>Consistent commercial metadata, legal pages, and onboarding guidance.</li>
        </ul>
      </section>
    </main>
  );
}
