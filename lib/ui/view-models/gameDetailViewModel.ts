import type { GameDetailPageData } from "@/lib/server/odds/gameDetailPageData";
import { getPropsDisplayState, type PropsDisplayState } from "@/lib/ui/propsDisplay";
import type { OutcomeResult } from "@/lib/server/odds/types";
import {
  formatAmericanOdds,
  formatBookCount,
  formatLongStartTime,
  formatMarketLabel,
  formatPercent,
  formatPoint,
  formatSignedPercent,
  formatSignedNumber,
  formatUpdatedLabel
} from "@/lib/ui/formatters/display";
import { getEvPresentation } from "@/lib/ui/evPresentation";

export type GameTabViewModel = {
  label: string;
  href: string | null;
  active: boolean;
  limited: boolean;
};

export type GameBookRowViewModel = {
  book: string;
  role: string;
  price: string;
  fair: string;
  line: string;
  impliedProbability: string;
  noVigProbability: string;
  weight: string;
  probabilityGap: string;
  ev: string;
  freshness: string;
  notes: string;
  isBest: boolean;
  isSharp: boolean;
};

export type GameDetailViewModel = {
  title: string;
  subtitle: string;
  backHref: string;
  status: string;
  marketHealth: string;
  summary: Array<{ label: string; value: string; tone?: "positive" | "warning" | "danger" | "neutral" }>;
  fairLine: Array<{ label: string; value: string }>;
  outcome: {
    label: string;
    tone: "positive" | "warning" | "danger" | "neutral";
    result: OutcomeResult | null;
    recordedPrice: string;
    recordedEv: string;
    recordedAt: string;
    settledAt: string;
    stakeUnits: string;
    profitLossUnits: string;
    roiPercent: string;
    identifiers: {
      sportKey: string;
      eventId: string;
      marketKey: string;
      sideKey: string;
    };
    canRecord: boolean;
  };
  tabs: GameTabViewModel[];
  comparisonRows: GameBookRowViewModel[];
  history: {
    available: boolean;
    updated: string;
    pressure: string;
    pressureExplanation: string;
    valuePersistence: string;
    edgeTrend: string;
    points: number;
  };
  qualityNotes: string[];
  modelNotes: string[];
  internalNotes: Array<{ label: string; value: string }> | null;
  props: PropsDisplayState;
};

function formatRole(isBest: boolean, isSharp: boolean): string {
  if (isBest) return "Best price";
  if (isSharp) return "Sharp";
  return "Market";
}

function formatLine(market: "h2h" | "spreads" | "totals", point?: number): string {
  if (market === "h2h") return "ML";
  return formatPoint(point);
}

function confidenceTone(label: string): "positive" | "warning" | "danger" | "neutral" {
  if (label === "High Confidence") return "positive";
  if (label === "Moderate Confidence") return "neutral";
  if (label === "Stale Market") return "warning";
  if (label === "Limited Sharp Coverage") return "neutral";
  if (label === "Thin Market") return "neutral";
  return "neutral";
}

function confidenceLabel(label: string): string {
  if (label === "High Confidence") return "High";
  if (label === "Moderate Confidence") return "Medium";
  if (label === "Limited Sharp Coverage") return "Sharp: Low";
  if (label === "Thin Market") return "Thin market";
  if (label === "Stale Market") return "Stale";
  return label;
}

function outcomePresentation(result: OutcomeResult | null | undefined): {
  label: string;
  tone: GameDetailViewModel["outcome"]["tone"];
} {
  if (result === "win") return { label: "Win", tone: "positive" };
  if (result === "loss") return { label: "Loss", tone: "danger" };
  if (result === "push") return { label: "Push", tone: "neutral" };
  if (result === "void") return { label: "Void", tone: "neutral" };
  if (result === "unknown") return { label: "Unknown", tone: "warning" };
  return { label: "Pending", tone: "neutral" };
}

function americanWinProfit(american: number | null | undefined): number | null {
  if (!Number.isFinite(american as number)) return null;
  const price = Number(american);
  if (price > 0) return price / 100;
  if (price < 0) return 100 / Math.abs(price);
  return null;
}

function profitForOutcome(result: OutcomeResult | null | undefined, price: number | null | undefined): number | null {
  if (result === "loss") return -1;
  if (result === "push" || result === "void") return 0;
  if (result === "win") return americanWinProfit(price);
  return null;
}

function formatTimestamp(ts?: number | string | null): string {
  if (!ts) return "—";
  const numeric = typeof ts === "number" ? ts : Date.parse(ts);
  if (!Number.isFinite(numeric)) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(numeric));
}

export function buildGameDetailViewModel(data: GameDetailPageData, options?: { includeInternal?: boolean }): GameDetailViewModel {
  const props = getPropsDisplayState();
  const pressure = data.pressureSignals[0] ?? null;
  const probabilityGapTone: "positive" | "neutral" = (data.featuredBook?.edgePct ?? 0) > 0 ? "positive" : "neutral";
  const evValue = data.featuredBook?.evReliability === "suppressed" ? null : data.featuredBook?.evPct;
  const evPresentation = evValue === null || evValue === undefined ? null : getEvPresentation(evValue);
  const evTone: "positive" | "warning" | "neutral" = evPresentation?.tone ?? "neutral";
  const summary = [
    { label: "Best price", value: data.featuredBook ? formatAmericanOdds(data.featuredBook.priceAmerican) : "—" },
    { label: "Book", value: data.featuredBook?.title || "—" },
    { label: "Fair odds", value: formatAmericanOdds(data.featuredOutcome.fairAmerican) },
    { label: "Gap", value: formatSignedPercent(data.featuredBook?.edgePct, 2), tone: probabilityGapTone },
    {
      label: "EV",
      value: evValue === null || evValue === undefined ? "—" : formatSignedPercent(evValue, 2),
      tone: evTone
    },
    {
      label: "Confidence",
      value: confidenceLabel(data.event.confidenceLabel),
      tone: confidenceTone(data.event.confidenceLabel)
    },
    { label: "Coverage", value: formatBookCount(data.event.contributingBookCount) },
    { label: "Updated", value: formatUpdatedLabel(data.featuredBook?.lastUpdate) }
  ];
  const trackedPrice = data.latestValidation?.execution.displayedPriceAmerican ?? data.featuredBook?.priceAmerican ?? null;
  const profit = profitForOutcome(data.outcomeResult?.result ?? null, trackedPrice);
  const outcomeStatus = outcomePresentation(data.outcomeResult?.result ?? null);
  const marketKey = data.internalContext.historyMarketKey;

  const fairLine = [
    { label: "Fair Probability", value: formatPercent(data.featuredOutcome.fairProb, 2) },
    { label: "Fair American Odds", value: formatAmericanOdds(data.featuredOutcome.fairAmerican) },
    { label: "Book Coverage", value: `${formatBookCount(data.event.contributingBookCount)} of ${formatBookCount(data.event.totalBookCount)}` },
    { label: "Model Type", value: data.model },
    { label: "Confidence", value: confidenceLabel(data.event.confidenceLabel) },
    { label: "Signal", value: data.pressureSignals[0]?.label || data.valueTiming.valuePersistence }
  ];

  const qualityNotes: string[] = [];
  if (data.currentMarketStatus === "limited") {
    qualityNotes.push("Comparable market coverage is limited.");
  }
  if (data.showRepresentativeNote) {
    qualityNotes.push("This view uses the most broadly available comparable line.");
  }
  if (data.featuredOutcome.confidenceNotes.length) {
    qualityNotes.push(...data.featuredOutcome.confidenceNotes.slice(0, 2));
  }
  if (data.featuredOutcome.staleSummary) {
    qualityNotes.push(data.featuredOutcome.staleSummary);
  }

  const modelNotes = [
    data.focusCopy,
    data.methodologyCopy
  ];
  if (data.featuredBook?.evReliability === "suppressed") {
    modelNotes.push("No actionable edge is displayed because market quality is below threshold.");
  }

  return {
    title: `${data.event.awayTeam} at ${data.event.homeTeam}`,
    subtitle: `${formatMarketLabel(data.event.market)} · ${formatLongStartTime(data.event.commenceTime)}`,
    backHref: data.backToBoardHref,
    status: Date.parse(data.event.commenceTime) <= Date.now() ? "Live" : "Upcoming",
    marketHealth:
      data.currentMarketStatus === "limited" ? "Limited" : data.currentMarketStatus === "unavailable" ? "Unavailable" : "Active",
    summary,
    fairLine,
    outcome: {
      label: outcomeStatus.label,
      tone: outcomeStatus.tone,
      result: data.outcomeResult?.result ?? null,
      recordedPrice: formatAmericanOdds(trackedPrice),
      recordedEv: formatSignedPercent(data.latestValidation?.model.evPct ?? data.featuredBook?.evPct ?? null, 2),
      recordedAt: formatTimestamp(data.latestValidation?.createdAt ?? null),
      settledAt: formatTimestamp(data.outcomeResult?.closeTimestamp ?? data.outcomeResult?.updatedAt ?? null),
      stakeUnits: "1.00u",
      profitLossUnits: Number.isFinite(profit) ? `${formatSignedNumber(profit, 2)}u` : "—",
      roiPercent: Number.isFinite(profit) ? formatSignedPercent(Number(profit) * 100, 2) : "—",
      identifiers: {
        sportKey: data.event.sportKey,
        eventId: data.event.id,
        marketKey,
        sideKey: data.featuredOutcome.name
      },
      canRecord: Boolean(options?.includeInternal)
    },
    tabs: data.marketSwitchOptions.map((option) => ({
      label: formatMarketLabel(option.market),
      href: option.href,
      active: option.market === data.event.market,
      limited: option.status === "limited"
    })),
    comparisonRows: data.featuredBooks.map((book) => ({
      book: book.title,
      role: formatRole(book.isBestPrice, book.isSharpBook || book.tier === "sharp"),
      price: formatAmericanOdds(book.priceAmerican),
      fair: formatAmericanOdds(book.fairPriceAmerican ?? data.featuredOutcome.fairAmerican),
      line: formatLine(data.event.market, book.point),
      impliedProbability: formatPercent(book.impliedProb, 2),
      noVigProbability: formatPercent(book.impliedProbNoVig, 2),
      weight: Number.isFinite(book.weight) ? Number(book.weight).toFixed(2) : "—",
      probabilityGap: formatSignedPercent(book.edgePct, 2),
      ev: book.evReliability === "suppressed" ? "—" : formatSignedPercent(book.evPct, 2),
      freshness: formatUpdatedLabel(book.lastUpdate),
      notes: [
        book.staleActionable ? "Stale" : "",
        book.priceValueDirection === "better_than_fair" ? "Above consensus" : "",
        book.priceValueDirection === "worse_than_fair" ? "Below market" : ""
      ]
        .filter(Boolean)
        .join(" · ") || "—",
      isBest: book.isBestPrice,
      isSharp: book.isSharpBook || book.tier === "sharp"
    })),
    history: {
      available: Boolean(data.timeline && data.timeline.points.length >= 2),
      updated: data.latestHistoryTs,
      pressure: pressure?.label || "none",
      pressureExplanation: pressure?.explanation || "Insufficient persisted history.",
      valuePersistence: data.valueTiming.valuePersistence,
      edgeTrend: data.valueTiming.edgeTrend,
      points: data.timeline?.points.length ?? 0
    },
    qualityNotes,
    modelNotes,
    internalNotes: options?.includeInternal
      ? [
          { label: "Route ID", value: data.routeId },
          { label: "History Event", value: data.internalContext.historyEventId },
          { label: "History Market", value: data.internalContext.historyMarketKey },
          { label: "Timeline Points", value: `${data.internalContext.timelinePoints}` },
          { label: "Pressure", value: data.internalContext.pressureLabel },
          { label: "Value Persistence", value: data.internalContext.valuePersistence }
        ]
      : null,
    props
  };
}
