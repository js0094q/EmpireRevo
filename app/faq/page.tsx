import type { Metadata } from "next";
import styles from "../legal.module.css";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers to common EmpirePicks questions about fair odds, EV, and market signals."
};

const faqs = [
  {
    q: "What is a fair line?",
    a: "A fair line is the market-implied price after removing sportsbook margin and averaging multiple books into a consensus view."
  },
  {
    q: "What is EV?",
    a: "EV is the expected-value signal for a selected price versus fair value. Positive values are usually better opportunities; neutral values may still be worth monitoring."
  },
  {
    q: "Why do some picks say the market is less favorable?",
    a: "That means the displayed sportsbook price is worse than the model's fair line. It is useful context, but it is not treated as an error state."
  },
  {
    q: "Should I only use strong EV signals?",
    a: "Strong EV is the clearest opportunity signal, but market confidence, liquidity, book availability, and freshness are also important for execution confidence."
  }
];

export default function FaqPage() {
  return (
    <main className={styles.legalPage}>
      <h1 className={styles.legalTitle}>FAQ</h1>
      <p className={styles.legalLead}>
        Quick answers for reading the board, comparing sportsbook prices, and understanding fair-line context.
      </p>
      <p className={styles.legalMeta}>Last updated: May 27, 2026</p>

      {faqs.map((item) => (
        <section key={item.q} className={styles.legalSection}>
          <h2>{item.q}</h2>
          <p>{item.a}</p>
        </section>
      ))}
    </main>
  );
}
