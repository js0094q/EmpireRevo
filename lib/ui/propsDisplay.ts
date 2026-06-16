export type PropMarketType = "main" | "player_props" | "team_props" | "game_props" | "futures";

export type PropsDisplayState = {
  mode: "standard" | "line_shopping_only";
  title: string;
  message: string;
  evVisible: boolean;
  metrics: string[];
};

export const PROP_MARKET_TYPE_OPTIONS: Array<{ value: PropMarketType; label: string }> = [
  { value: "main", label: "Main Lines" },
  { value: "player_props", label: "Player Props" },
  { value: "team_props", label: "Team Props" },
  { value: "game_props", label: "Game Props" },
  { value: "futures", label: "Futures / Outrights" }
];

export function getPropsDisplayState(): PropsDisplayState {
  return {
    mode: "line_shopping_only",
    title: "No prop markets are currently available for this league or event.",
    message:
      "Props are shown as line shopping only until comparable markets can produce a defensible fair probability.",
    evVisible: false,
    metrics: ["Best book", "Best price", "Book count", "Last updated"]
  };
}
