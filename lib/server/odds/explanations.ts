import type { ConfidenceAssessment } from "@/lib/server/odds/confidence";
import { buildPriceVsFairExplanation, buildPriceVsFairMetrics, classifyOpportunityStrength } from "@/lib/odds/priceValue";
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
    const metrics = buildPriceVsFairMetrics({
      marketPriceAmerican: Number.isFinite(bestBook.marketPriceAmerican) ? Number(bestBook.marketPriceAmerican) : bestBook.priceAmerican,
      fairPriceAmerican: Number.isFinite(bestBook.fairPriceAmerican) ? Number(bestBook.fairPriceAmerican) : bestBook.priceAmerican,
      marketImpliedProb: Number.isFinite(bestBook.marketImpliedProb) ? Number(bestBook.marketImpliedProb) : bestBook.impliedProb,
      fairImpliedProb: Number.isFinite(bestBook.fairImpliedProb) ? Number(bestBook.fairImpliedProb) : bestBook.impliedProbNoVig
    });
    const strength = classifyOpportunityStrength({
      marketPrice: metrics.marketPriceAmerican,
      fairPrice: metrics.fairPriceAmerican,
      marketImpliedProb: metrics.marketImpliedProb,
      fairImpliedProb: metrics.fairImpliedProb,
      probabilityGapPctPoints: metrics.probabilityGapPct,
      priceValueDirection: metrics.priceValueDirection
    });
    const favoriteStatus = metrics.fairPriceAmerican < 0 ? "favorite" : metrics.fairPriceAmerican > 0 ? "underdog" : "neutral";
    const priceSummary = buildPriceVsFairExplanation({
      marketPriceAmerican: metrics.marketPriceAmerican,
      fairPriceAmerican: metrics.fairPriceAmerican,
      marketImpliedProb: metrics.marketImpliedProb,
      fairImpliedProb: metrics.fairImpliedProb,
      direction: metrics.priceValueDirection,
      strength,
      favoriteStatus
    }).replace(/\.$/, "");
    clauses.push(`${bestBook.title} on ${params.outcomeName}: ${priceSummary}`);
  } else {
    clauses.push(`${params.outcomeName} shows measurable model disagreement`);
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

  if (
    params.ranking.staleStrength >= 0.6 &&
    bestBook?.staleActionable &&
    params.confidence.score >= 0.55 &&
    bestBook.evQualified
  ) {
    clauses.push(`${params.staleSummary.toLowerCase()} increases actionability`);
  } else if (params.ranking.staleStrength <= 0.25) {
    clauses.push("no strong stale-line signal is present");
  } else if (params.ranking.staleStrength >= 0.6) {
    clauses.push(`${params.staleSummary.toLowerCase()} is present but not fully actionable`);
  }

  if (Math.abs(params.ranking.sharpDeviation) >= 1.2) {
    if (params.ranking.sharpDeviation > 0) {
      clauses.push("sharp books imply a better price than retail consensus");
    } else {
      clauses.push("retail books are pricing this side richer than sharp consensus");
    }
  }

  if (params.timingSignal.label !== "Weak timing signal") {
    clauses.push(`timing signal: ${params.timingSignal.label.toLowerCase()}`);
  }

  return clauses.slice(0, 4).join("; ") + ".";
}
