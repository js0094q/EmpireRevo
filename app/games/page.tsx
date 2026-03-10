import { OddsGridClient } from "@/app/ui-client";
import { ErrorState } from "@/components/board/ErrorState";
import { fetchFairBoardServer, hasOddsKey } from "@/lib/server/odds/pageData";
import { sportKeyToLeague } from "@/lib/server/odds/client";

export const dynamic = "force-dynamic";

function ConfigRequired() {
  return (
    <ErrorState
      title="Configuration Required"
      message="ODDS_API_KEY is missing on the server. Add it to .env.local and Vercel environment variables."
      hint="No client-side requests are attempted until server configuration is present."
    />
  );
}

type SearchParams = {
  league?: string;
  sportKey?: string;
  market?: string;
  model?: string;
  window?: string;
};

export default async function GamesPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  if (!hasOddsKey()) {
    return <ConfigRequired />;
  }

  const params = (await searchParams) || {};
  const leagueFromSport = params.sportKey ? sportKeyToLeague(params.sportKey) : undefined;
  const league = params.league || leagueFromSport || "nba";
  const market = params.market === "spreads" || params.market === "totals" ? params.market : "h2h";
  const model =
    params.model === "sharp" || params.model === "equal" || params.model === "weighted"
      ? (params.model as "sharp" | "equal" | "weighted")
      : "weighted";
  const windowHours = params.window === "today" ? 12 : 24;

  const result = await fetchFairBoardServer({
    league,
    market,
    model,
    windowHours,
    historyWindowHours: 72
  })
    .then((board) => ({ board, error: null as (Error & { code?: string; status?: number }) | null }))
    .catch((error) => ({ board: null as null, error: error as Error & { code?: string; status?: number } }));

  if (result.error) {
    const e = result.error;
    let title = "Games board unavailable";
    let message = "Unexpected error while loading the game board.";
    let hint: string = e.message || "Try refreshing shortly.";

    if (e.code === "UPSTREAM_AUTH_FAILURE") {
      title = "Upstream authentication failed";
      message = "EmpirePicks could not authenticate with the odds feed.";
      hint = "Verify the API key and upstream account status.";
    } else if (e.code === "UPSTREAM_RATE_LIMIT") {
      title = "Odds feed rate limited";
      message = "The upstream provider temporarily blocked this request.";
      hint = "Wait a moment, then refresh. Cached snapshots may still be available.";
    } else if (e.code === "UPSTREAM_EMPTY_PAYLOAD") {
      title = "No games in this window";
      message = "The selected filters returned an empty schedule.";
      hint = "Switch leagues or widen the time window.";
    }

    return <ErrorState title={title} message={message} hint={hint} />;
  }

  const board = result.board;
  if (!board || !board.events.length) {
    return (
      <ErrorState
        title="No books currently offer this market"
        message="Try another league, market, or time window."
        hint="The schedule loaded, but no comparable offers were available for the selected view."
      />
    );
  }

  return <OddsGridClient board={board} league={league} windowKey={params.window === "today" ? "today" : "next24"} mode="games" />;
}
