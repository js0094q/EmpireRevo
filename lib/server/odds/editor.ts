import type { BoardResponse, DerivedGame } from "@/lib/odds/schemas";

function topSide(game: DerivedGame) {
  return game.markets.flatMap((market) => market.sides).sort((a, b) => b.evPct - a.evPct)[0];
}

export function buildEditorNote(params: {
  comingUp: DerivedGame[];
  bestValueNow: DerivedGame[];
  feedCount: number;
}): BoardResponse["editorNote"] {
  const { comingUp, bestValueNow, feedCount } = params;
  const firstUpcoming = comingUp[0];
  const topGame = bestValueNow[0];
  const topSignal = topGame ? topSide(topGame) : undefined;

  const firstLabel = firstUpcoming
    ? `${firstUpcoming.event.away.name} at ${firstUpcoming.event.home.name}`
    : "No marquee games in the next 24 hours";

  const signalLabel = topGame && topSignal
    ? `${topGame.event.away.name} at ${topGame.event.home.name} (${topSignal.label} ${topSignal.evPct.toFixed(1)}% EV)`
    : "No high-confidence edge currently stands out";

  return {
    headline: "Live Market Brief",
    body: `Market pressure remains active across books. ${firstLabel} is up next, while ${signalLabel} carries the strongest weighted signal right now.`,
    watchlist: [
      feedCount > 0
        ? `Track rapid move alerts before entry; ${feedCount} notable events are active.`
        : "Watch for fresh movement as books refresh toward kickoff.",
      "Prioritize spots where sharp-weighted lean exceeds 2.0 percentage points."
    ],
    lockLike: [
      "Highest Confidence setup only when variance is low, recency is fresh, and multi-book alignment persists."
    ]
  };
}

export const BOARD_DISCLAIMER =
  "Market intelligence only. This is not financial advice or a guaranteed outcome.";
