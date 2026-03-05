import { headers } from "next/headers";
import { BoardClient } from "./ui-client";
import type { BoardResponse } from "@/lib/odds/schemas";

export const dynamic = "force-dynamic";

async function getBoard(): Promise<BoardResponse> {
  const h = await headers();
  const host = h.get("host") || "localhost:3000";
  const proto = host.includes("localhost") ? "http" : "https";
  const res = await fetch(`${proto}://${host}/api/board?league=nba`, { cache: "no-store" });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = typeof body?.error === "string" ? body.error : "";
    } catch {
      // ignore parse failures and use generic status text
    }
    throw new Error(detail ? `Failed to load board (${res.status}): ${detail}` : `Failed to load board: ${res.status}`);
  }
  return res.json();
}

function fallbackBoard(reason: string): BoardResponse {
  return {
    league: "nba",
    updatedAt: new Date().toISOString(),
    editorNote: {
      headline: "Configuration Required",
      body: `Live data is unavailable right now. ${reason}. Set ODDS_API_KEY in your deployment environment and redeploy.`,
      watchlist: ["Add ODDS_API_KEY in Vercel Project Settings -> Environment Variables."],
      lockLike: ["Once configured, the board will populate automatically."]
    },
    comingUp: [],
    bestValueNow: [],
    games: [],
    feed: []
  };
}

export default async function Page() {
  const board = await getBoard().catch((err: unknown) => {
    const reason = err instanceof Error ? err.message : "Unknown server error";
    return fallbackBoard(reason);
  });
  return <BoardClient board={board} />;
}
