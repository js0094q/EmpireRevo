import type { Metadata } from "next";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Props Roadmap",
  description: "Testing-phase structure for future props market support in EmpirePicks."
};

export default function PropsPage() {
  return (
    <main className={styles.legalPage}>
      <h1 className={styles.legalTitle}>Props roadmap</h1>
      <p className={styles.legalLead}>
        Props are being kept out of the main board while the testing build validates freshness, coverage, and fair-line behavior on core markets.
      </p>
      <p className={styles.legalMeta}>Public read-only preview. No signup or paid access workflow is active.</p>

      <section className={styles.legalSection}>
        <h2>Planned structure</h2>
        <ul className={styles.legalList}>
          <li>Dedicated props route so player markets do not clutter the main board.</li>
          <li>Same freshness, book coverage, and stale-market labeling rules as the core market board.</li>
          <li>No fabricated player history, CLV, ROI, or performance records.</li>
        </ul>
      </section>
    </main>
  );
}
