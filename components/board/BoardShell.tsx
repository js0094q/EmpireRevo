"use client";

import type { FairBoardResponse } from "@/lib/server/odds/types";
import { BoardView } from "@/components/board/BoardView";

export function BoardShell({ board, league }: { board: FairBoardResponse; league: string }) {
  return <BoardView board={board} league={league} model={board.model} mode="board" />;
}
