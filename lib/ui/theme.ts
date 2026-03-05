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
