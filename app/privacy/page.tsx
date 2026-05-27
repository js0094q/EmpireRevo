import type { Metadata } from "next";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "EmpirePicks privacy and data handling policy."
};

export default function PrivacyPage() {
  return (
    <main className={styles.legalPage}>
      <h1 className={styles.legalTitle}>Privacy Policy</h1>
      <p className={styles.legalLead}>We keep data practices lean and transparent.</p>
      <p className={styles.legalMeta}>Last updated: May 27, 2026</p>

      <section className={styles.legalSection}>
        <h2>What we collect</h2>
        <ul className={styles.legalList}>
          <li>Operational logs (timing, route, status, request identifiers).</li>
          <li>Local preferences (view mode, filters, pinned books).</li>
          <li>Anonymous health metrics and cache diagnostics.</li>
        </ul>
      </section>

      <section className={styles.legalSection}>
        <h2>What we do not collect</h2>
        <ul className={styles.legalList}>
          <li>No raw betting account credentials.</li>
          <li>No payment or banking details.</li>
          <li>No sensitive profile enrichment beyond site usage context.</li>
        </ul>
      </section>

      <section className={styles.legalSection}>
        <h2>Retention</h2>
        <p>
          Local browser preferences remain in browser storage and can be cleared at any time. Operational telemetry retention is managed per infrastructure settings and
          documented in deployment controls.
        </p>
      </section>
    </main>
  );
}
