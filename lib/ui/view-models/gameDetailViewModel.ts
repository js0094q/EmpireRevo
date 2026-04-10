import type { GameDetailPageData } from "@/lib/server/odds/gameDetailPageData";
import {
  formatAmericanOdds,
  formatBookCount,
  formatLongStartTime,
  formatMarketLabel,
  formatPercent,
  formatPoint,
  formatSignedPercent,
  formatUpdatedLabel
} from "@/lib/ui/formatters/display";

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
  line: string;
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
};

function formatRole(isBest: boolean, isSharp: boolean): string {
  if (isBest) return "Best";
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
  return "danger";
}

export function buildGameDetailViewModel(data: GameDetailPageData, options?: { includeInternal?: boolean }): GameDetailViewModel {
  const pressure = data.pressureSignals[0] ?? null;
  const edgeTone: "positive" | "neutral" = (data.featuredBook?.edgePct ?? 0) > 0 ? "positive" : "neutral";
  const summary = [
    { label: "Best", value: data.featuredBook ? formatAmericanOdds(data.featuredBook.priceAmerican) : "—" },
    { label: "Book", value: data.featuredBook?.title || "—" },
    { label: "Fair", value: formatAmericanOdds(data.featuredOutcome.fairAmerican) },
    { label: "Edge", value: formatSignedPercent(data.featuredBook?.edgePct, 2), tone: edgeTone },
    {
      label: "Confidence",
      value: data.event.confidenceLabel,
      tone: confidenceTone(data.event.confidenceLabel)
    },
    { label: "Books", value: formatBookCount(data.event.contributingBookCount) },
    { label: "Updated", value: formatUpdatedLabel(data.featuredBook?.lastUpdate) }
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
    modelNotes.push("Displayed edge is suppressed by defensibility rules.");
  }

  return {
    title: `${data.event.awayTeam} at ${data.event.homeTeam}`,
    subtitle: `${formatMarketLabel(data.event.market)} · ${formatLongStartTime(data.event.commenceTime)}`,
    backHref: data.backToBoardHref,
    status: Date.parse(data.event.commenceTime) <= Date.now() ? "Live" : "Upcoming",
    marketHealth: data.currentMarketStatus === "limited" ? "Limited" : "Active",
    summary,
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
      line: formatLine(data.event.market, book.point),
      freshness: formatUpdatedLabel(book.lastUpdate),
      notes: [
        book.staleActionable ? "Stale" : "",
        Number.isFinite(book.evPct) ? `EV ${formatSignedPercent(book.evPct, 2)}` : ""
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
      : null
  };
}
