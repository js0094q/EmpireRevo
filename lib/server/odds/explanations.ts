import type { ConfidenceAssessment } from "@/lib/server/odds/confidence";
import type { OpportunityRanking } from "@/lib/server/odds/ranking";
import type { FairOutcomeBook, TimingSignal } from "@/lib/server/odds/types";

type ExplanationParams = {
  outcomeName: string;
  confidence: ConfidenceAssessment;
  ranking: OpportunityRanking;
  books: FairOutcomeBook[];
  staleSummary: string;
  timingSignal: TimingSignal;
};

export function buildOpportunityExplanation(params: ExplanationParams): string {
  const bestBook = params.books.find((book) => book.bookKey === params.ranking.bestBookKey);
  const clauses: string[] = [];

  if (bestBook) {
    clauses.push(`${bestBook.title} offers ${params.outcomeName} with ${params.ranking.bestEdgePct.toFixed(2)}% edge`);
  } else {
    clauses.push(`${params.outcomeName} shows a measurable pricing edge`);
  }

  if (params.confidence.label === "High Confidence") {
    clauses.push("coverage and sharp participation both support the fair line");
  } else if (params.confidence.label === "Thin Market") {
    clauses.push("coverage is thin, so confidence is reduced");
  } else if (params.confidence.label === "Stale Market") {
    clauses.push("market updates are stale and confidence is capped");
  } else if (params.confidence.label === "Limited Sharp Coverage") {
    clauses.push("sharp-book participation is limited");
  } else {
    clauses.push("confidence is moderate with mixed support");
  }

  if (params.ranking.staleStrength >= 0.6) {
    clauses.push(`${params.staleSummary.toLowerCase()} increases actionability`);
  } else if (params.ranking.staleStrength <= 0.25) {
    clauses.push("no strong stale-line signal is present");
  }

  if (Math.abs(params.ranking.sharpDeviation) >= 1.2) {
    if (params.ranking.sharpDeviation > 0) {
      clauses.push("sharp books are more favorable than retail consensus");
    } else {
      clauses.push("retail pricing is richer than sharp consensus");
    }
  }

  if (params.timingSignal.label !== "Weak timing signal") {
    clauses.push(`timing signal: ${params.timingSignal.label.toLowerCase()}`);
  }

  return clauses.slice(0, 4).join("; ") + ".";
}
