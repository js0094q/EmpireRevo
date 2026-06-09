import type { Metadata } from "next";
import { TrackedLink } from "@/components/analytics/TrackedLink";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Contact EmpirePicks",
  description: "Contact information and support options for EmpirePicks."
};

export default function ContactPage() {
  return (
    <main className={styles.legalPage}>
      <h1 className={styles.legalTitle}>Contact</h1>
      <p className={styles.legalLead}>EmpirePicks is in testing. The public build is a read-only preview of the analytics workstation.</p>
      <p className={styles.legalMeta}>No signup, account, payment, or waitlist workflow is active.</p>
      <div className={styles.ctaRow}>
        <a className={styles.primaryCta} href="mailto:support@empirepicks.app">
          Email support
        </a>
        <TrackedLink
          className={styles.secondaryCta}
          href="/transparency"
          eventName="transparency_cta"
          eventProperties={{ placement: "contact_hero" }}
        >
          Review methodology
        </TrackedLink>
      </div>

      <section className={styles.legalSection}>
        <h2>Support channels</h2>
        <div className={styles.contactLinks}>
          <a className={styles.contactLink} href="mailto:support@empirepicks.app">
            support@empirepicks.app
          </a>
          <TrackedLink
            className={styles.contactLink}
            href="/transparency"
            eventName="transparency_cta"
            eventProperties={{ placement: "contact_support" }}
          >
            Review transparency methodology
          </TrackedLink>
          <a className={styles.contactLink} href="/responsible-gaming">
            Responsible Gaming resources
          </a>
          <a className={styles.contactLink} href="/about">
            Learn more about the platform
          </a>
        </div>
      </section>

      <section className={styles.legalSection}>
        <h2>Response expectations</h2>
        <p>
          Testing feedback is reviewed during release cycles. Do not send wagering account credentials, API keys, or private betting account data.
        </p>
      </section>
    </main>
  );
}
