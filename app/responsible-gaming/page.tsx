import type { Metadata } from "next";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Responsible Gaming",
  description: "Responsible gaming expectations and support links."
};

export default function ResponsibleGamingPage() {
  return (
    <main className={styles.legalPage}>
      <h1 className={styles.legalTitle}>Responsible Gaming</h1>
      <p className={styles.legalLead}>EmpirePicks is built for informed analysis, not compulsive wagering.</p>
      <p className={styles.legalMeta}>If gambling is not a positive activity for you, stop now.</p>

      <section className={styles.legalSection}>
        <h2>Core principle</h2>
        <p>
          Markets move quickly. Use opportunities as context and enforce your own limits before you act. Never chase losses or spend money you cannot afford to lose.
        </p>
      </section>

      <section className={styles.legalSection}>
        <h2>Practical guardrails</h2>
        <ul className={styles.legalList}>
          <li>Set per-session and weekly bankroll caps.</li>
          <li>Stop after preset loss limits.</li>
          <li>Do not place wagers under emotional pressure or after poor outcomes.</li>
          <li>Use EV as a signal only, not as a mandate.</li>
        </ul>
      </section>

      <section className={styles.legalSection}>
        <h2>Resources</h2>
        <ul className={styles.legalList}>
          <li>National Suicide &amp; Crisis resources: 988 (US)</li>
          <li>Problem Gambling helpline: 1800-522-4700 (Canada)</li>
          <li>Use local support resources available in your region.</li>
        </ul>
      </section>
    </main>
  );
}
