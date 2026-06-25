import test from "node:test";
import assert from "node:assert/strict";
import { getBoardEmptyStateCopy } from "../lib/ui/boardEmptyState";

test("World Cup empty state distinguishes no posted markets from no sportsbook odds", () => {
  assert.deepEqual(
    getBoardEmptyStateCopy({
      leagueKey: "fifa_world_cup",
      providerEventCount: 0
    }),
    {
      title: "No FIFA World Cup markets are currently available.",
      message: "Try another league or check back when provider markets are posted."
    }
  );

  assert.deepEqual(
    getBoardEmptyStateCopy({
      leagueKey: "fifa_world_cup",
      providerEventCount: 2
    }),
    {
      title: "FIFA World Cup is enabled, but no sportsbook odds are currently available from the provider.",
      message: "Try another market or check back closer to kickoff."
    }
  );
});
