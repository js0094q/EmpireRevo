import { ErrorState } from "@/components/board/ErrorState";
import { BoardShell } from "@/components/board/BoardShell";
import { fetchFairBoardPageData, hasOddsKey } from "@/lib/server/odds/pageData";
import { sportKeyToLeague } from "@/lib/server/odds/client";
import { redirect } from "next/navigation";

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
  const windowHours = 168;

  const result = await fetchFairBoardPageData({
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
      title = "No games available";
      message = "The selected league and market returned an empty schedule.";
      hint = "Switch leagues or market.";
    }

    return <ErrorState title={title} message={message} hint={hint} />;
  }

  const pageData = result.board;
  if (!pageData) {
    return (
      <ErrorState
        title="Games board unavailable"
        message="Unexpected error while loading the game board."
        hint="Missing board payload."
      />
    );
  }

  if (pageData.resolvedMarket !== market) {
    const nextParams = new URLSearchParams();
    nextParams.set("league", league);
    nextParams.set("market", pageData.resolvedMarket);
    if (model !== "weighted") nextParams.set("model", model);
    redirect(`/games?${nextParams.toString()}`);
  }

  const board = pageData.board;
  if (!(board.boardRows?.length ?? 0)) {
    return (
      <ErrorState
        title="No live lines available"
        message="Try another league or check back when more books are posting."
        hint="EmpirePicks only shows markets with live comparable prices."
      />
    );
  }

  return <BoardShell board={board} league={league} />;
}
