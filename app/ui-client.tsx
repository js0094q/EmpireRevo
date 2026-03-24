"use client";

import type { FairBoardResponse } from "@/lib/server/odds/types";
import { BoardShell } from "@/components/board/BoardShell";
import type { BoardMode } from "@/components/board/board-helpers";

type OddsGridClientProps = {
  board: FairBoardResponse;
  league: string;
  mode?: BoardMode;
};

export function OddsGridClient(props: OddsGridClientProps) {
  return <BoardShell {...props} />;
}
