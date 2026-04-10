import { headers } from "next/headers";
import { ErrorState } from "@/components/primitives/ErrorState";
import { GameDetailView } from "@/components/game/GameDetailView";
import { hasOddsKey } from "@/lib/server/odds/pageData";
import { authorizeInternalHeaders } from "@/lib/server/odds/internalAuth";
import { getGameDetailPageData } from "@/lib/server/odds/gameDetailPageData";
import { buildGameDetailViewModel } from "@/lib/ui/view-models/gameDetailViewModel";

export const dynamic = "force-dynamic";

export default async function GamePage({
  params,
  searchParams
}: {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{
    league?: string;
    market?: string;
    model?: string;
    mode?: string;
    sort?: string;
    side?: string;
    search?: string;
    edge?: string;
  }>;
}) {
  if (!hasOddsKey()) {
    return <ErrorState title="Configuration required" message="ODDS_API_KEY is missing on the server." detail="Add it to .env.local and the deployment environment before loading game detail." />;
  }

  const { eventId } = await params;
  const query = (await searchParams) || {};
  let data = null;
  try {
    data = await getGameDetailPageData({ eventId, query });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected detail load failure";
    return <ErrorState title="Odds unavailable" message="Game detail could not be loaded." detail={message} />;
  }

  if (!data) {
    return <ErrorState title="Game unavailable" message="The requested event is not in the current live board." detail="Return to the board and choose another market." />;
  }

  const headerStore = await headers();
  const internalAuth = authorizeInternalHeaders(headerStore);
  const viewModel = buildGameDetailViewModel(data, { includeInternal: internalAuth.ok });

  return <GameDetailView viewModel={viewModel} data={data} />;
}
