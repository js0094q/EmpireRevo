import type { Metadata } from "next";
import Link from "next/link";
import { learnArticles } from "./content";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "Sports Betting Strategy Guides",
  description: "EmpirePicks guides for EV betting, CLV, bankroll discipline, line shopping, and market inefficiencies."
};

export default function LearnPage() {
  return (
    <main className={styles.legalPage}>
      <h1 className={styles.legalTitle}>Strategy guides</h1>
      <p className={styles.legalLead}>
        Practical explainers for reading sportsbook prices, fair lines, CLV, bankroll risk, and market movement without
        unsupported performance claims.
      </p>
      <section className={styles.pricingGrid} aria-label="Strategy guide topics">
        {learnArticles.map((article) => (
          <article key={article.slug} className={styles.pricingCard}>
            <strong>{article.title}</strong>
            <p>{article.description}</p>
            <Link className={styles.inlineLink} href={`/learn/${article.slug}`}>
              Read guide
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
