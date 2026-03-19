import type { FairBoardResponse, FairEvent, FairOutcome, FairOutcomeBook } from "@/lib/server/odds/types";

export type BoardMode = "board" | "games";
export type BoardSortKey = "score" | "edge" | "confidence" | "best" | "soonest" | "timing";
export type BoardWindowKey = "all" | "today" | "next24";
export type BoardSideKey = "all" | "favored" | "underdogs";

export const SORT_OPTIONS: Array<{ value: BoardSortKey; label: string }> = [
  { value: "score", label: "Top opportunities" },
  { value: "edge", label: "Biggest edge" },
  { value: "confidence", label: "Most stable market" },
  { value: "best", label: "Best payout" },
  { value: "soonest", label: "Starting soon" },
  { value: "timing", label: "Closing soon" }
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
  eventId: string;
  league: string;
  market: FairEvent["market"];
  model: "sharp" | "equal" | "weighted";
}): string {
  const query = new URLSearchParams({
    league: params.league,
    market: params.market,
    model: params.model
  });
  return `/game/${encodeURIComponent(params.eventId)}?${query.toString()}`;
}
