import type { Metadata } from "next";
import { TrackedLink } from "@/components/analytics/TrackedLink";
import { LeadCapture } from "@/components/lead/LeadCapture";
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
    features: ["Live board preview", "Fair-line methodology", "Launch updates"],
    intent: "launch_access",
    checkoutUrl: ""
  },
  {
    name: "Individual",
    price: "Invite",
    description: "Best for bettors who want a daily pricing workstation.",
    features: ["Pinned books", "Market filters", "Detail pages", "Transparency updates"],
    intent: "individual_checkout",
    checkoutUrl: process.env.NEXT_PUBLIC_EMPIRE_CHECKOUT_INDIVIDUAL_URL || ""
  },
  {
    name: "Pro",
    price: "Invite",
    description: "Best for power users who care about workflow and auditability.",
    features: ["Priority onboarding", "Advanced diagnostics", "CLV/ROI methodology", "Feature feedback loop"],
    intent: "pro_checkout",
    checkoutUrl: process.env.NEXT_PUBLIC_EMPIRE_CHECKOUT_PRO_URL || ""
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
        <LeadCapture
          triggerLabel="Request launch access"
          title="Request EmpirePicks launch access"
          intent="launch_access"
          variant="primary"
          placement="pricing_hero"
        />
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
            {tier.checkoutUrl ? (
              <TrackedLink
                href={tier.checkoutUrl}
                className={styles.primaryCta}
                eventName="checkout_start"
                eventProperties={{ placement: "pricing_card", tier: tier.name }}
              >
                Start checkout
              </TrackedLink>
            ) : (
              <LeadCapture
                triggerLabel={tier.name === "Launch Watchlist" ? "Join watchlist" : "Request invite"}
                title={`${tier.name} access`}
                intent={tier.intent}
                variant={tier.name === "Launch Watchlist" ? "secondary" : "primary"}
                placement={`pricing_${tier.name.toLowerCase().replaceAll(" ", "_")}`}
              />
            )}
          </article>
        ))}
      </section>

      <section className={styles.legalSection}>
        <h2>Checkout configuration</h2>
        <p>
          Self-serve checkout is configuration-ready through
          <code> NEXT_PUBLIC_EMPIRE_CHECKOUT_INDIVIDUAL_URL </code>
          and
          <code> NEXT_PUBLIC_EMPIRE_CHECKOUT_PRO_URL</code>. Until those URLs are configured, paid-plan actions route to
          launch-access capture rather than pretending payment is live.
        </p>
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
