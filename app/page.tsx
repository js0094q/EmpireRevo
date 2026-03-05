import { headers } from "next/headers";
import type { FairBoardResponse } from "@/lib/server/odds/types";
import { OddsGridClient } from "./ui-client";
import { hasOddsKey, toSportKey } from "@/lib/server/odds/pageData";

export const dynamic = "force-dynamic";

async function getFairBoard(params: {
  league: string;
  market: "h2h" | "spreads" | "totals";
  model: "sharp" | "equal";
  windowHours: number;
}): Promise<FairBoardResponse> {
  const h = await headers();
  const host = h.get("host") || "localhost:3000";
  const proto = host.includes("localhost") ? "http" : "https";
  const sportKey = toSportKey(params.league);

  const endpoint = new URL(`${proto}://${host}/api/fair`);
  endpoint.searchParams.set("sportKey", sportKey);
  endpoint.searchParams.set("market", params.market);
  endpoint.searchParams.set("model", params.model);
  endpoint.searchParams.set("windowHours", String(params.windowHours));

  const res = await fetch(endpoint.toString(), { cache: "no-store" });
  if (!res.ok) {
    let detail = "";
    try {
      const json = await res.json();
      detail = json?.error || "";
    } catch {
      // ignore parse errors
    }
    throw new Error(detail ? `Failed to load fair board (${res.status}): ${detail}` : `Failed to load fair board (${res.status})`);
  }

  return res.json();
}

function ConfigRequired() {
  return (
    <main className="config-shell">
      <section className="config-card">
        <h1>Configuration Required</h1>
        <p>ODDS_API_KEY is missing on the server. Add it to `.env.local` and Vercel environment variables.</p>
        <p className="muted">No client-side requests are attempted until server configuration is present.</p>
      </section>
    </main>
  );
}

export default async function Page({
  searchParams
}: {
  searchParams?: Promise<{ league?: string; market?: string; model?: string; window?: string }>;
}) {
  if (!hasOddsKey()) {
    return <ConfigRequired />;
  }

  const params = (await searchParams) || {};
  const league = params.league || "nba";
  const market = params.market === "spreads" || params.market === "totals" ? params.market : "h2h";
  const model = params.model === "equal" ? "equal" : "sharp";
  const windowHours = params.window === "today" ? 12 : 24;

  const board = await getFairBoard({
    league,
    market,
    model,
    windowHours
  });

  return <OddsGridClient board={board} league={league} windowKey={params.window === "today" ? "today" : "next24"} />;
}
