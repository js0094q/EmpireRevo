import type { Metadata } from "next";
import { TrackedLink } from "@/components/analytics/TrackedLink";
import { LeadCapture } from "@/components/lead/LeadCapture";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Contact EmpirePicks",
  description: "Contact information and support options for EmpirePicks."
};

export default function ContactPage() {
  return (
    <main className={styles.legalPage}>
      <h1 className={styles.legalTitle}>Contact</h1>
      <p className={styles.legalLead}>Have a support request, enterprise question, or integration inquiry?</p>
      <p className={styles.legalMeta}>EmpirePicks is preparing a formal ticket workflow.</p>
      <div className={styles.ctaRow}>
        <LeadCapture
          triggerLabel="Request launch access"
          title="Request EmpirePicks launch access"
          intent="contact"
          variant="primary"
          placement="contact_hero"
        />
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
            href="/pricing"
            eventName="pricing_cta"
            eventProperties={{ placement: "contact_support" }}
          >
            Request launch access
          </TrackedLink>
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
          We prioritize production incidents, access issues, and integration questions. Product and feature feedback is reviewed during each release cycle.
        </p>
      </section>
    </main>
  );
}
