import { headers } from "next/headers";
import Link from "next/link";
import { ErrorState } from "@/components/primitives/ErrorState";
import { GameDetailView } from "@/components/game/GameDetailView";
import { hasOddsKey } from "@/lib/server/odds/pageData";
import { authorizeInternalHeaders } from "@/lib/server/odds/internalAuth";
import { getGameDetailPageData } from "@/lib/server/odds/gameDetailPageData";
import { buildGameDetailViewModel } from "@/lib/ui/view-models/gameDetailViewModel";
import styles from "@/components/primitives/primitives.module.css";

export const dynamic = "force-dynamic";

type SearchParams = {
  league?: string;
  market?: string;
  model?: string;
  mode?: string;
  sort?: string;
  side?: string;
  search?: string;
  edge?: string;
};

export default async function GamePage({
  params,
  searchParams
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  if (!hasOddsKey()) {
    return <ErrorState title="Configuration required" message="ODDS_API_KEY is missing on the server." detail="Add it to .env.local and the deployment environment before loading game detail." />;
  }

  const { eventId } = await params;
  const query = (await searchParams) || {};

  let data = null;
  try {
    data = await getGameDetailPageData({ eventId, query });
  } catch {
    const retryParams = new URLSearchParams();
    if (query.league) retryParams.set("league", query.league);
    if (query.market) retryParams.set("market", query.market);
    if (query.model) retryParams.set("model", query.model);
    if (query.mode) retryParams.set("mode", query.mode);
    if (query.sort) retryParams.set("sort", query.sort);
    if (query.side) retryParams.set("side", query.side);
    if (query.search) retryParams.set("search", query.search);
    if (query.edge) retryParams.set("edge", query.edge);

    return (
      <ErrorState
        title="Game detail unavailable"
        message="Game detail could not be loaded right now."
        detail="Please try again shortly or return to the board for a fresh selection."
        actions={
          <div style={{ display: "grid", gap: "0.55rem", gridTemplateColumns: "repeat(auto-fit,minmax(120px, 1fr))" }}>
            <Link href={`/game/${encodeURIComponent(eventId)}?${retryParams.toString()}`} className={styles.button}>
              Retry
            </Link>
            <Link href="/" className={`${styles.button} ${styles.buttonPrimary}`}>
              Back to board
            </Link>
          </div>
        }
      />
    );
  }

  if (!data) {
    return <ErrorState title="Game unavailable" message="The requested event is not in the current live board." detail="Return to the board and choose another market." />;
  }

  const headerStore = await headers();
  const internalAuth = authorizeInternalHeaders(headerStore);
  const viewModel = buildGameDetailViewModel(data, { includeInternal: internalAuth.ok });

  return <GameDetailView viewModel={viewModel} data={data} />;
}
