import type { MarketKey } from "@/lib/odds/schemas";

const NULL_DISPLAY = "—";

export function formatNull(value?: string | number | null): string {
  if (value === null || value === undefined || value === "") return NULL_DISPLAY;
  return String(value);
}

export function formatAmericanOdds(value?: number | null): string {
  if (!Number.isFinite(value as number)) return NULL_DISPLAY;
  const rounded = Math.round(Number(value));
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

export function formatPercent(value?: number | null, digits = 1): string {
  if (!Number.isFinite(value as number)) return NULL_DISPLAY;
  return `${(Number(value) * 100).toFixed(digits)}%`;
}

export function formatSignedPercent(value?: number | null, digits = 1): string {
  if (!Number.isFinite(value as number)) return NULL_DISPLAY;
  const numeric = Number(value);
  return `${numeric > 0 ? "+" : ""}${numeric.toFixed(digits)}%`;
}

export function formatSignedNumber(value?: number | null, digits = 1, suffix = ""): string {
  if (!Number.isFinite(value as number)) return NULL_DISPLAY;
  const numeric = Number(value);
  return `${numeric > 0 ? "+" : ""}${numeric.toFixed(digits)}${suffix}`;
}

export function formatBookCount(value?: number | null): string {
  if (!Number.isFinite(value as number)) return NULL_DISPLAY;
  const count = Math.round(Number(value));
  return `${count} ${count === 1 ? "book" : "books"}`;
}

export function formatModelLabel(model: "sharp" | "equal" | "weighted"): string {
  if (model === "sharp") return "Sharp";
  if (model === "equal") return "Equal";
  return "Weighted";
}

export function formatMarketLabel(market: MarketKey): string {
  if (market === "spreads") return "Spread";
  if (market === "totals") return "Total";
  return "Moneyline";
}

export function formatPoint(value?: number | null): string {
  if (!Number.isFinite(value as number)) return NULL_DISPLAY;
  const numeric = Number(value);
  return numeric > 0 ? `+${numeric}` : `${numeric}`;
}

export function formatStartTime(iso?: string | null): string {
  if (!iso) return NULL_DISPLAY;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return NULL_DISPLAY;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(ts));
}

export function formatLongStartTime(iso?: string | null): string {
  if (!iso) return NULL_DISPLAY;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return NULL_DISPLAY;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(ts));
}

export function formatUpdatedLabel(iso?: string | null, fallback = "Updated recently"): string {
  if (!iso) return fallback;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return fallback;
  const diffMs = Date.now() - ts;
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSeconds < 60) return "Updated <1m ago";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `Updated ${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Updated ${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `Updated ${diffDays}d ago`;
}

export function formatConfidenceLabel(label?: string | null): string {
  return label || NULL_DISPLAY;
}

export function formatLeagueLabel(league: string): string {
  const upper = league.toUpperCase();
  if (upper === "NCAAB") return "NCAAB";
  return upper;
}

export function formatShortDate(iso?: string | null): string {
  if (!iso) return NULL_DISPLAY;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return NULL_DISPLAY;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric"
  }).format(new Date(ts));
}
