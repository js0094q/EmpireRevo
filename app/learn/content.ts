export type LearnArticle = {
  slug: string;
  title: string;
  description: string;
  sections: Array<{ heading: string; body: string }>;
};

export const learnArticles: LearnArticle[] = [
  {
    slug: "ev-betting",
    title: "Expected value betting",
    description: "How EmpirePicks frames expected value without treating it as a guarantee.",
    sections: [
      {
        heading: "What EV means",
        body: "Expected value compares a posted sportsbook price with a fair probability estimate. Positive EV means the offered payout is better than the fair line implies, not that the bet is certain to win."
      },
      {
        heading: "Why fair probability matters",
        body: "EmpirePicks removes sportsbook margin and builds a market consensus before calculating the gap between posted price and fair value."
      },
      {
        heading: "Launch limitation",
        body: "Short-run results can diverge from EV. Public ROI and units should only be reviewed with sample size, settled outcomes, and close-reference context."
      }
    ]
  },
  {
    slug: "clv",
    title: "Closing line value",
    description: "Why CLV is tracked in implied-probability space and kept separate from ROI.",
    sections: [
      {
        heading: "What CLV measures",
        body: "CLV compares the recommendation-time price with a later closing reference. It is a price-quality signal, not a realized profit claim."
      },
      {
        heading: "How EmpirePicks evaluates it",
        body: "The system compares implied probabilities from recommendation and close snapshots when matching market history exists."
      },
      {
        heading: "Why it stays caveated",
        body: "When a close snapshot is missing, CLV remains null instead of being inferred from a later or unrelated market."
      }
    ]
  },
  {
    slug: "bankroll",
    title: "Bankroll discipline",
    description: "A conservative framework for using edge signals without over-sizing risk.",
    sections: [
      {
        heading: "Units first",
        body: "A unit-based workflow keeps performance review separate from account size and discourages emotional stake changes."
      },
      {
        heading: "Avoid signal stacking",
        body: "A larger edge number is not enough by itself. Coverage, confidence, freshness, and market type should all influence actionability."
      },
      {
        heading: "Responsible use",
        body: "EmpirePicks is for analysis support. It does not remove financial risk or guarantee outcomes."
      }
    ]
  },
  {
    slug: "line-shopping",
    title: "Line shopping",
    description: "How to compare posted prices against fair lines and book coverage.",
    sections: [
      {
        heading: "Best price is not always best decision",
        body: "The best posted price has to be evaluated against fair odds, market freshness, and whether the line is actionable at books a user can access."
      },
      {
        heading: "Why points matter",
        body: "For spreads and totals, price comparison must respect point differences. EmpirePicks keeps spread and total comparisons point-aware."
      },
      {
        heading: "Execution context",
        body: "Pinned books and regional availability should drive which opportunities are realistically actionable."
      }
    ]
  },
  {
    slug: "market-inefficiencies",
    title: "Market inefficiencies",
    description: "How EmpirePicks treats stale prices, fragmented books, and market movement.",
    sections: [
      {
        heading: "Market gaps",
        body: "A market gap appears when a book's posted price differs from the no-vig fair line built from the broader market."
      },
      {
        heading: "Freshness and fragmentation",
        body: "Stale books, low coverage, and fragmented markets can make an apparent edge less reliable. These signals should reduce confidence rather than be hidden."
      },
      {
        heading: "No fabricated edges",
        body: "EmpirePicks should only show movement and history-backed signals when the underlying observations exist."
      }
    ]
  }
];

export function findLearnArticle(slug: string): LearnArticle | undefined {
  return learnArticles.find((article) => article.slug === slug);
}
