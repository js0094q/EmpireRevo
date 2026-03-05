import { headers } from "next/headers";
import { BoardClient } from "./ui-client";
import type { BoardResponse } from "@/lib/odds/schemas";

export const dynamic = "force-dynamic";

async function getBoard(league: string): Promise<BoardResponse> {
  const h = await headers();
  const host = h.get("host") || "localhost:3000";
  const proto = host.includes("localhost") ? "http" : "https";
  const res = await fetch(`${proto}://${host}/api/board?sport=${league}`, { cache: "no-store" });

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = typeof body?.error === "string" ? body.error : "";
    } catch {
      // ignore parse errors and fallback to status only
    }

    throw new Error(detail ? `Failed to load board (${res.status}): ${detail}` : `Failed to load board: ${res.status}`);
  }

  return res.json();
}

function fallbackBoard(reason: string, league: string): BoardResponse {
  const safeLeague = ["nfl", "nba", "nhl", "ncaab", "mlb"].includes(league) ? (league as BoardResponse["league"]) : "nba";
  return {
    league: safeLeague,
    updatedAt: new Date().toISOString(),
    meta: {
      generatedAt: new Date().toISOString(),
      windowHours: 24,
      disclaimer: "Market intelligence only. This is not financial advice or a guaranteed outcome."
    },
    editorNote: {
      headline: "Configuration Required",
      body: `Live market data is unavailable right now. ${reason}`,
      watchlist: ["Set ODDS_API_KEY in Vercel Project Settings and redeploy."],
      lockLike: ["Highest Confidence setup appears once markets and key configuration are active."]
    },
    comingUp: [],
    bestValueNow: [],
    games: [],
    feed: []
  };
}

export default async function Page({ searchParams }: { searchParams?: Promise<{ league?: string }> }) {
  const params = (await searchParams) || {};
  const league = params.league || "nba";

  const board = await getBoard(league).catch((err: unknown) => {
    const reason = err instanceof Error ? err.message : "Unknown server error";
    return fallbackBoard(reason, league);
  });

  return <BoardClient board={board} />;
}
