export type BoardScope = "board" | "props";
export type PropType = "main" | "player" | "team" | "game" | "futures";
export type MarketFamily = "main" | "player_prop" | "team_prop" | "game_prop" | "future" | "alternate" | "unsupported";
export type PropsEmptyReason =
  | "NO_EVENTS"
  | "NO_MAIN_MARKETS"
  | "PROPS_UNSUPPORTED_FOR_LEAGUE"
  | "PROPS_SUPPORTED_BUT_NONE_AVAILABLE"
  | "EVENT_REQUIRED"
  | "API_ERROR"
  | "SPARSE_COVERAGE"
  | "MARKET_NOT_COMPATIBLE";

export type PropsDisplayState = {
  mode: "standard" | "line_shopping_only";
  title: string;
  message: string;
  evVisible: boolean;
  metrics: string[];
  reason?: PropsEmptyReason;
};

export const PROP_MARKET_TYPE_OPTIONS: Array<{ value: PropType; label: string }> = [
  { value: "main", label: "Main Lines" },
  { value: "player", label: "Player Props" },
  { value: "team", label: "Team Props" },
  { value: "game", label: "Game Props" },
  { value: "futures", label: "Futures / Outrights" }
];

export function normalizeBoardScope(value: string | null | undefined): BoardScope {
  return value === "props" ? "props" : "board";
}

export function normalizePropType(value: string | null | undefined): PropType {
  if (value === "player" || value === "player_props") return "player";
  if (value === "team" || value === "team_props") return "team";
  if (value === "game" || value === "game_props") return "game";
  if (value === "futures") return "futures";
  return "main";
}

export function propTypeLabel(propType: PropType): string {
  return PROP_MARKET_TYPE_OPTIONS.find((option) => option.value === propType)?.label ?? "Props";
}

export function getPropsDisplayState(params?: {
  reason?: PropsEmptyReason;
  leagueLabel?: string;
  propType?: PropType;
}): PropsDisplayState {
  const leagueLabel = params?.leagueLabel || "This league";
  const propType = params?.propType ?? "player";
  const propLabel = propTypeLabel(propType).toLowerCase();
  const reason = params?.reason;
  if (reason === "NO_EVENTS") {
    return {
      mode: "line_shopping_only",
      title: "No events are currently available.",
      message: "Props require an active event before market prices can be displayed.",
      evVisible: false,
      metrics: ["Best book", "Best price", "Book count", "Last updated"],
      reason
    };
  }
  if (reason === "NO_MAIN_MARKETS") {
    return {
      mode: "standard",
      title: `No ${leagueLabel} main-line markets are currently available.`,
      message: "Main lines use moneyline, spread, and total markets when the provider has comparable prices.",
      evVisible: true,
      metrics: ["Best book", "Best price", "Book count", "Last updated"],
      reason
    };
  }
  if (reason === "PROPS_UNSUPPORTED_FOR_LEAGUE") {
    const subject = propType === "main" ? "props" : propLabel;
    return {
      mode: "line_shopping_only",
      title: `${leagueLabel} ${subject} are not currently supported by the odds provider.`,
      message:
        propType === "main"
          ? `Main markets are still available for ${leagueLabel}. Switch to Main Lines to continue browsing.`
          : "Main markets remain available when posted; unsupported prop markets are not requested.",
      evVisible: false,
      metrics: ["Best book", "Best price", "Book count", "Last updated"],
      reason
    };
  }
  if (reason === "EVENT_REQUIRED") {
    return {
      mode: "line_shopping_only",
      title: "Select a game to view event-level player props.",
      message: "Props are fetched per event to avoid slowing the default board.",
      evVisible: false,
      metrics: ["Best book", "Best price", "Book count", "Last updated"],
      reason
    };
  }
  if (reason === "PROPS_SUPPORTED_BUT_NONE_AVAILABLE") {
    return {
      mode: "line_shopping_only",
      title: "Props are available for this league, but no markets are currently posted for this event.",
      message: "Check back closer to game time or switch to main lines.",
      evVisible: false,
      metrics: ["Best book", "Best price", "Book count", "Last updated"],
      reason
    };
  }
  if (reason === "API_ERROR") {
    return {
      mode: "line_shopping_only",
      title: "Prop markets could not be loaded.",
      message: "The main board is preserved; refresh or try another event.",
      evVisible: false,
      metrics: ["Best book", "Best price", "Book count", "Last updated"],
      reason
    };
  }
  if (reason === "SPARSE_COVERAGE" || reason === "MARKET_NOT_COMPATIBLE") {
    return {
      mode: "line_shopping_only",
      title: "This market is shown for line shopping only because comparable fair-line pricing is not available.",
      message: "Best book, best price, line value, coverage, and update time remain visible.",
      evVisible: false,
      metrics: ["Best book", "Best price", "Book count", "Last updated"],
      reason
    };
  }

  return {
    mode: "line_shopping_only",
    title: "No prop markets are currently available for this league or event.",
    message:
      "Props are shown as line shopping only until comparable markets can produce a defensible fair probability.",
    evVisible: false,
    metrics: ["Best book", "Best price", "Book count", "Last updated"]
  };
}
