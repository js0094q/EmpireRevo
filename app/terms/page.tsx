import type { Metadata } from "next";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "EmpirePicks platform terms of service."
};

export default function TermsPage() {
  return (
    <main className={styles.legalPage}>
      <h1 className={styles.legalTitle}>Terms of Service</h1>
      <p className={styles.legalLead}>Use of EmpirePicks is provided by your own account and discretion.</p>
      <p className={styles.legalMeta}>Last updated: May 27, 2026</p>

      <section className={styles.legalSection}>
        <h2>License</h2>
        <p>
          EmpirePicks grants a limited, revocable, non-exclusive right to access the platform for personal review and lawful use. Content and analytics are for
          information support only.
        </p>
      </section>

      <section className={styles.legalSection}>
        <h2>Use restrictions</h2>
        <ul className={styles.legalList}>
          <li>Do not use platform data for unlawful betting automation.</li>
          <li>Do not attempt to bypass route protections or abuse public limits.</li>
          <li>Do not reproduce, mirror, or redistribute snapshots without written permission.</li>
        </ul>
      </section>

      <section className={styles.legalSection}>
        <h2>Availability</h2>
        <p>
          Availability is not guaranteed at all times. We may temporarily reduce functionality, deploy updates, or disable routes to preserve platform integrity or comply
          with upstream constraints.
        </p>
      </section>

      <section className={styles.legalSection}>
        <h2>Liability</h2>
        <p>
          No representation is made that any signal guarantees profit, positive outcomes, or specific betting performance. You remain responsible for all wagering actions.
        </p>
      </section>
    </main>
  );
}
