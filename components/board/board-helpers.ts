import type { FairBoardResponse, FairEvent, FairOutcome, FairOutcomeBook } from "@/lib/server/odds/types";
import {
  buildPriceVsFairExplanation,
  buildPriceVsFairMetrics,
  type PriceValueDirection,
  type PriceVsFairMetrics
} from "@/lib/odds/priceValue";
import { toEventRouteId } from "@/lib/server/odds/eventRoute";

export type BoardMode = "board" | "games";
export type BoardSortKey = "score" | "edge" | "confidence" | "best" | "soonest" | "timing";
export type BoardWindowKey = "all";
export type BoardSideKey = "all" | "favored" | "underdogs";
export type BoardNavigationContext = {
  mode?: BoardMode;
  windowKey?: BoardWindowKey;
  sortBy?: BoardSortKey;
  side?: BoardSideKey;
  search?: string;
  positiveEdgeOnly?: boolean;
};

export const SORT_OPTIONS: Array<{ value: BoardSortKey; label: string }> = [
  { value: "score", label: "Top Opportunities" },
  { value: "edge", label: "Largest Probability Gap" },
  { value: "confidence", label: "Most Stable Market" },
  { value: "best", label: "Highest Listed Odds" },
  { value: "soonest", label: "Starting Soon" },
  { value: "timing", label: "Closing Soon" }
];

export function formatAmerican(price?: number | null): string {
  if (!Number.isFinite(price as number)) return "--";
  const value = Number(price);
  return value > 0 ? `+${value}` : `${value}`;
}

export function formatPoint(point?: number | null): string {
  if (!Number.isFinite(point as number)) return "--";
  const value = Number(point);
  return value > 0 ? `+${value}` : `${value}`;
}

export function formatMarketLabel(market: FairBoardResponse["market"]): string {
  if (market === "spreads") return "Spread";
  if (market === "totals") return "Total";
  return "Moneyline";
}

export function formatCommenceTime(iso: string): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return "Start time unavailable";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(ts));
}

export function formatUpdatedLabel(updatedAtIso: string): string {
  const ts = Date.parse(updatedAtIso);
  if (!Number.isFinite(ts)) return "Updated recently";
  const minutes = Math.max(0, Math.floor((Date.now() - ts) / 60_000));
  const relative = minutes < 1 ? "just now" : `${minutes}m ago`;
  return `${relative} · ${new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(ts))} ET`;
}

export function topOutcome(event: FairEvent): FairOutcome {
  return [...event.outcomes].sort((a, b) => {
    const aEdge = topBook(a)?.edgePct ?? 0;
    const bEdge = topBook(b)?.edgePct ?? 0;
    return b.opportunityScore - a.opportunityScore || bEdge - aEdge;
  })[0]!;
}

export function topBook(outcome: FairOutcome): FairOutcomeBook | null {
  return [...outcome.books].sort((a, b) => b.edgePct - a.edgePct || b.evPct - a.evPct)[0] ?? null;
}

export function strongestBook(outcome: FairOutcome): FairOutcomeBook | null {
  return [...outcome.books].sort((a, b) => Math.abs(b.edgePct) - Math.abs(a.edgePct) || b.edgePct - a.edgePct)[0] ?? null;
}

export function strongestOutcome(event: FairEvent): FairOutcome {
  return [...event.outcomes].sort((a, b) => {
    const aEdge = Math.abs(strongestBook(a)?.edgePct ?? 0);
    const bEdge = Math.abs(strongestBook(b)?.edgePct ?? 0);
    return bEdge - aEdge || b.opportunityScore - a.opportunityScore;
  })[0]!;
}

export function bestPriceBook(outcome: FairOutcome): FairOutcomeBook | null {
  return outcome.books.find((book) => book.isBestPrice) ?? outcome.books[0] ?? null;
}

export type PickStatus = "Favorite" | "Underdog";
export type RecommendationLabel = "Best Value" | "Model Lean" | "Near Fair";
export type PickSummary = {
  outcome: FairOutcome;
  book: FairOutcomeBook | null;
  label: RecommendationLabel;
  status: PickStatus;
  priceValueDirection: PriceValueDirection;
  priceVsFair: PriceVsFairMetrics | null;
  probabilityGapPct: number;
  hasRecommendation: boolean;
  whyThisPick: string;
};

export function recommendedOutcome(event: FairEvent): FairOutcome {
  return [...event.outcomes].sort((a, b) => {
    const aGap = Math.abs(priceVsFairMetrics(a, bestPriceBook(a))?.probabilityGapPct ?? 0);
    const bGap = Math.abs(priceVsFairMetrics(b, bestPriceBook(b))?.probabilityGapPct ?? 0);
    return b.opportunityScore - a.opportunityScore || bGap - aGap;
  })[0]!;
}

export function pickStatus(outcome: FairOutcome): PickStatus {
  if (outcome.consensusDirection === "favored") return "Favorite";
  if (outcome.consensusDirection === "underdog") return "Underdog";
  return outcome.fairAmerican > 0 ? "Underdog" : "Favorite";
}

export function whyThisPickText(params: {
  direction: PriceValueDirection;
  hasRecommendation: boolean;
  probabilityGapPct: number;
}): string {
  if (params.hasRecommendation) {
    return `Model and market both support this side at the available price. Probability gap ${formatProbabilityGap(params.probabilityGapPct)}.`;
  }

  if (params.direction === "worse_than_fair") {
    return `Model disagreement exists, but available payout is worse than fair. Probability gap ${formatProbabilityGap(params.probabilityGapPct)}.`;
  }
  return `Available payout is close to fair value. Probability gap ${formatProbabilityGap(params.probabilityGapPct)}.`;
}

function toFavoriteStatus(outcome: FairOutcome): "favorite" | "underdog" | "neutral" {
  if (outcome.consensusDirection === "favored") return "favorite";
  if (outcome.consensusDirection === "underdog") return "underdog";
  return "neutral";
}

export function formatProbabilityGap(probabilityGapPct: number): string {
  const rounded = Math.round(probabilityGapPct * 100) / 100;
  const prefix = rounded > 0 ? "+" : "";
  return `${prefix}${rounded.toFixed(2)}pp`;
}

export function priceVsFairMetrics(outcome: FairOutcome, book: FairOutcomeBook | null): PriceVsFairMetrics | null {
  if (!book) return null;
  return buildPriceVsFairMetrics({
    marketPriceAmerican: Number.isFinite(book.marketPriceAmerican) ? Number(book.marketPriceAmerican) : book.priceAmerican,
    fairPriceAmerican: Number.isFinite(book.fairPriceAmerican) ? Number(book.fairPriceAmerican) : outcome.fairAmerican,
    marketImpliedProb: Number.isFinite(book.marketImpliedProb) ? book.marketImpliedProb : book.impliedProbNoVig,
    fairImpliedProb: Number.isFinite(book.fairImpliedProb) ? book.fairImpliedProb : outcome.fairProb
  });
}

export function recommendationLabelFromDirection(direction: PriceValueDirection): RecommendationLabel {
  if (direction === "better_than_fair") return "Best Value";
  if (direction === "worse_than_fair") return "Model Lean";
  return "Near Fair";
}

export function formatPriceValueDirection(direction: PriceValueDirection): string {
  if (direction === "better_than_fair") return "Better Than Fair";
  if (direction === "worse_than_fair") return "Worse Than Fair";
  return "Near Fair";
}

export function marketVsModelCopy(params: {
  market: FairEvent["market"];
  outcome: FairOutcome;
  book: FairOutcomeBook | null;
}): string {
  const fairValue = formatOffer(params.market, params.outcome);
  if (!params.book) return `Market pricing is unavailable. Model fair value is ${fairValue}.`;

  const metrics = priceVsFairMetrics(params.outcome, params.book);
  if (!metrics) return `Market pricing is unavailable. Model fair value is ${fairValue}.`;

  return buildPriceVsFairExplanation({
    marketPriceAmerican: metrics.marketPriceAmerican,
    fairPriceAmerican: metrics.fairPriceAmerican,
    marketImpliedProb: metrics.marketImpliedProb,
    fairImpliedProb: metrics.fairImpliedProb,
    direction: metrics.priceValueDirection,
    favoriteStatus: toFavoriteStatus(params.outcome)
  });
}

export function buildOutcomeSummary(outcome: FairOutcome): PickSummary {
  const book = bestPriceBook(outcome);
  const status = pickStatus(outcome);
  const priceVsFair = priceVsFairMetrics(outcome, book);
  const direction = priceVsFair?.priceValueDirection ?? "near_fair";
  const hasRecommendation = direction === "better_than_fair";
  const probabilityGapPct = priceVsFair?.probabilityGapPct ?? 0;

  return {
    outcome,
    book,
    label: recommendationLabelFromDirection(direction),
    status,
    priceValueDirection: direction,
    priceVsFair,
    probabilityGapPct,
    hasRecommendation,
    whyThisPick: whyThisPickText({
      direction,
      hasRecommendation,
      probabilityGapPct
    })
  };
}

export function buildPickSummary(event: FairEvent): PickSummary {
  return buildOutcomeSummary(recommendedOutcome(event));
}

export function formatOffer(
  market: FairEvent["market"],
  book: Pick<FairOutcomeBook, "priceAmerican" | "point"> | Pick<FairOutcome, "fairAmerican" | "books">
): string {
  const price = "priceAmerican" in book ? book.priceAmerican : book.fairAmerican;
  const point = "books" in book ? book.books[0]?.point : book.point;
  if (market === "h2h") return formatAmerican(price);
  return `${formatPoint(point)} · ${formatAmerican(price)}`;
}

export function confidenceTone(label: FairEvent["confidenceLabel"]): "positive" | "warning" | "neutral" {
  if (label === "High Confidence") return "positive";
  if (label === "Moderate Confidence") return "warning";
  return "neutral";
}

export function movementTone(outcome: FairOutcome): "positive" | "warning" | "neutral" {
  if (outcome.movementQuality === "strong") return "positive";
  if (outcome.movementQuality === "moderate") return "warning";
  return "neutral";
}

export function edgeTone(edgePct: number): "positive" | "warning" | "neutral" | "danger" {
  if (edgePct >= 1) return "positive";
  if (edgePct >= 0.2) return "warning";
  if (edgePct <= -0.5) return "danger";
  return "neutral";
}

export function updatedMinutes(updatedAtIso: string): number {
  const ts = Date.parse(updatedAtIso);
  if (!Number.isFinite(ts)) return 0;
  return Math.max(0, Math.floor((Date.now() - ts) / 60_000));
}

export function eventHasPartialData(event: FairEvent): boolean {
  return event.contributingBookCount < event.totalBookCount || event.excludedBooks.length > 0;
}

export function eventDetailHref(params: {
  event: FairEvent;
  league: string;
  market: FairEvent["market"];
  model: "sharp" | "equal" | "weighted";
  context?: BoardNavigationContext;
}): string {
  const query = new URLSearchParams({
    league: params.league,
    market: params.market,
    model: params.model
  });
  if (params.context?.mode === "games") query.set("mode", "games");
  if (params.context?.sortBy && params.context.sortBy !== "score") query.set("sort", params.context.sortBy);
  if (params.context?.side && params.context.side !== "all") query.set("side", params.context.side);
  const search = params.context?.search?.trim();
  if (search) query.set("search", search);
  if (params.context?.positiveEdgeOnly) query.set("edge", "1");
  return `/games/${encodeURIComponent(toEventRouteId(params.event))}?${query.toString()}`;
}
