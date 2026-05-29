import type { Metadata } from "next";
import { TrackedLink } from "@/components/analytics/TrackedLink";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "EmpirePicks Launch Access",
  description:
    "Review EmpirePicks launch access options for fair-line sportsbook pricing, line shopping, and transparent market analytics."
};

const tiers = [
  {
    name: "Launch Watchlist",
    price: "Free",
    description: "Best for evaluating the product before paid access opens.",
    features: ["Live board preview", "Fair-line methodology", "Launch updates"]
  },
  {
    name: "Individual",
    price: "Invite",
    description: "Best for bettors who want a daily pricing workstation.",
    features: ["Pinned books", "Market filters", "Detail pages", "Transparency updates"]
  },
  {
    name: "Pro",
    price: "Invite",
    description: "Best for power users who care about workflow and auditability.",
    features: ["Priority onboarding", "Advanced diagnostics", "CLV/ROI methodology", "Feature feedback loop"]
  }
];

export default function PricingPage() {
  return (
    <main className={styles.legalPage}>
      <h1 className={styles.legalTitle}>Launch access</h1>
      <p className={styles.legalLead}>
        EmpirePicks is built as a pricing workstation: fair lines, line shopping, confidence context, and audit-ready
        evaluation infrastructure without tout-style performance claims.
      </p>
      <div className={styles.ctaRow}>
        <TrackedLink
          href="mailto:support@empirepicks.app?subject=EmpirePicks%20launch%20access"
          className={styles.primaryCta}
          eventName="pricing_cta"
          eventProperties={{ placement: "pricing_hero", intent: "launch_access" }}
        >
          Request launch access
        </TrackedLink>
        <TrackedLink
          href="/transparency"
          className={styles.secondaryCta}
          eventName="transparency_cta"
          eventProperties={{ placement: "pricing_hero" }}
        >
          Review methodology
        </TrackedLink>
      </div>

      <section className={styles.pricingGrid} aria-label="Launch access options">
        {tiers.map((tier) => (
          <article key={tier.name} className={styles.pricingCard}>
            <strong>{tier.name}</strong>
            <span className={styles.priceValue}>{tier.price}</span>
            <p>{tier.description}</p>
            <ul className={styles.featureList}>
              {tier.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className={styles.legalSection}>
        <h2>What paid users should expect</h2>
        <p>
          The product should earn trust through price transparency, reproducible methodology, and conservative claims.
          Public ROI and win-rate claims should remain gated until sample sizes are durable, outcome data is complete,
          and users can audit the calculation path.
        </p>
      </section>

      <section className={styles.legalSection}>
        <h2>Not a pick-selling launch</h2>
        <p>
          EmpirePicks is positioned as a market analytics platform. The board shows posted price, fair line, gap,
          opportunity, book coverage, confidence, and freshness so users can evaluate decisions rather than consume
          unsupported predictions.
        </p>
      </section>
    </main>
  );
}
