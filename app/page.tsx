import { ErrorState } from "@/components/primitives/ErrorState";
import { BoardView } from "@/components/board/BoardView";
import { fetchFairBoardPageData, hasOddsKey } from "@/lib/server/odds/pageData";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function ConfigRequired() {
  return <ErrorState title="Configuration required" message="ODDS_API_KEY is missing on the server." detail="Add it to .env.local and the deployment environment before loading the board." />;
}

export default async function Page({
  searchParams
}: {
  searchParams?: Promise<{ league?: string; market?: string; model?: string; minBooks?: string }>;
}) {
  if (!hasOddsKey()) {
    return <ConfigRequired />;
  }

  const params = (await searchParams) || {};
  const league = params.league || "nba";
  const market = params.market === "spreads" || params.market === "totals" ? params.market : "h2h";
  const model = params.model === "sharp" || params.model === "equal" || params.model === "weighted" ? (params.model as "sharp" | "equal" | "weighted") : "weighted";
  const minBooks = Math.max(2, Math.min(6, Number(params.minBooks || "4") || 4));
  const windowHours = 168;

  const result = await fetchFairBoardPageData({
    league,
    market,
    model,
    minBooks,
    windowHours,
    historyWindowHours: 72
  })
    .then((board) => ({ board, error: null as (Error & { code?: string; status?: number }) | null }))
    .catch((error) => ({ board: null as null, error: error as Error & { code?: string; status?: number } }));

  if (result.error) {
    const e = result.error;
    let title = "Live odds unavailable";
    let message = "Unexpected error while building the fair board.";
    let hint: string = e.message || "Please try refreshing shortly.";

    if (e.code === "UPSTREAM_AUTH_FAILURE") {
      title = "Upstream authentication failed";
      message = "EmpirePicks could not authenticate with the odds feed.";
      hint = "Verify the API key and account status in your provider dashboard.";
    } else if (e.code === "UPSTREAM_RATE_LIMIT") {
      title = "Odds feed is temporarily unavailable";
      message = "The upstream provider rate limited this request.";
      hint = "Wait a moment, then refresh. Cached snapshots may still be available.";
    } else if (e.code === "UPSTREAM_EMPTY_PAYLOAD") {
      title = "No games available";
      message = "The feed returned an empty schedule for this league and market.";
      hint = "Try another league or market.";
    }

    return <ErrorState title={title} message={message} detail={hint} />;
  }

  const pageData = result.board;
  if (!pageData) {
    return (
      <ErrorState
        title="Odds unavailable"
        message="Unexpected error while building the board."
        detail="Missing board payload."
      />
    );
  }

  if (pageData.resolvedMarket !== market) {
    const nextParams = new URLSearchParams();
    nextParams.set("league", league);
    nextParams.set("market", pageData.resolvedMarket);
    if (model !== "weighted") nextParams.set("model", model);
    if (minBooks !== 4) nextParams.set("minBooks", `${minBooks}`);
    redirect(`/?${nextParams.toString()}`);
  }

  const board = pageData.board;
  if (!(board.events?.length ?? 0)) {
    return (
      <ErrorState
        title="No qualifying markets for current filters."
        message="Try another league, market, or book threshold."
        detail="EmpirePicks only shows markets with live comparable prices."
      />
    );
  }

  return <BoardView board={board} league={league} model={model} mode="board" />;
}
