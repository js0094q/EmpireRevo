import { headers } from "next/headers";
import { BoardClient } from "./ui-client";
import type { BoardResponse } from "@/lib/odds/schemas";

export const dynamic = "force-dynamic";

async function getBoard(): Promise<BoardResponse> {
  const h = await headers();
  const host = h.get("host") || "localhost:3000";
  const proto = host.includes("localhost") ? "http" : "https";
  const res = await fetch(`${proto}://${host}/api/board?league=nba`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load board: ${res.status}`);
  return res.json();
}

export default async function Page() {
  const board = await getBoard();
  return <BoardClient board={board} />;
}
