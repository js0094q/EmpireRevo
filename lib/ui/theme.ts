import type { FairBoardResponse } from "@/lib/server/odds/types";

export const themeTokens = {
  colors: {
    background: "#070b10",
    surface: "#0d121a",
    surfaceMuted: "#121923",
    text: "#f1f4f7",
    textMuted: "#9ea8b5",
    textDim: "#6f7986",
    accent: "#64abff",
    positive: "#65d6ad",
    warning: "#edb85e",
    danger: "#f07c7c",
    border: "rgba(255,255,255,0.08)",
    highlight: "rgba(100,171,255,0.42)"
  },
  spacing: {
    xs: "0.35rem",
    sm: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.5rem"
  },
  radii: {
    sm: "0.55rem",
    md: "0.8rem",
    lg: "1rem",
    xl: "1.35rem",
    pill: "999px"
  },
  shadows: {
    md: "0 18px 40px rgba(0, 0, 0, 0.24)",
    xl: "0 30px 80px rgba(0, 0, 0, 0.34)"
  },
  typography: {
    body: "\"Sohne\", \"Avenir Next\", \"SF Pro Display\", sans-serif",
    mono: "\"JetBrains Mono\", \"SFMono-Regular\", Menlo, monospace"
  }
} as const;

export const LEAGUES = [
  { key: "nba", label: "NBA" },
  { key: "nfl", label: "NFL" },
  { key: "nhl", label: "NHL" },
  { key: "ncaab", label: "NCAAB" },
  { key: "mlb", label: "MLB" }
] as const;

export function teamInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || "")
    .join("");
}

export function formatAmerican(price?: number): string {
  if (price === undefined || price === null || Number.isNaN(price)) return "--";
  return price > 0 ? `+${price}` : `${price}`;
}

export function movementIcon(icon?: string): string {
  if (icon === "bolt") return "⚡";
  if (icon === "up") return "▲";
  if (icon === "down") return "▼";
  return "•";
}

export function marketLabel(market: FairBoardResponse["market"]): string {
  if (market === "spreads") return "Spread";
  if (market === "totals") return "Total";
  return "Moneyline";
}
