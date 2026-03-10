import test from "node:test";
import assert from "node:assert/strict";
import { resetPersistenceForTests } from "../lib/server/odds/persistence";
import { getOutcomeResult, listOutcomeResults, persistOutcomeResult } from "../lib/server/odds/outcomes";

test.beforeEach(() => {
  resetPersistenceForTests();
});

test("outcome persistence stores and retrieves final result payload", async () => {
  await persistOutcomeResult({
    sportKey: "basketball_nba",
    eventId: "evt-1",
    marketKey: "h2h:away",
    sideKey: "away",
    result: "win",
    finalScore: "112-108",
    closeTimestamp: "2026-03-01T03:00:00.000Z",
    source: "manual",
    updatedAt: 1_710_000_000_000
  });

  const stored = await getOutcomeResult({
    sportKey: "basketball_nba",
    eventId: "evt-1",
    marketKey: "h2h:away",
    sideKey: "away"
  });

  assert.ok(stored);
  assert.equal(stored?.result, "win");
  assert.equal(stored?.finalScore, "112-108");
  assert.equal(stored?.source, "manual");

  const list = await listOutcomeResults(10);
  assert.equal(list.length, 1);
  assert.equal(list[0]?.id, "basketball_nba:evt-1:h2h:away:away");
});

test("outcome persistence updates existing entries without changing identity", async () => {
  const first = await persistOutcomeResult({
    sportKey: "basketball_nba",
    eventId: "evt-2",
    marketKey: "h2h:home",
    sideKey: "home",
    result: "unknown",
    updatedAt: 1_710_000_000_000
  });

  const second = await persistOutcomeResult({
    sportKey: "basketball_nba",
    eventId: "evt-2",
    marketKey: "h2h:home",
    sideKey: "home",
    result: "loss",
    updatedAt: 1_710_000_100_000
  });

  assert.equal(second.id, first.id);
  assert.equal(second.createdAt, first.createdAt);
  assert.equal(second.updatedAt, 1_710_000_100_000);
  assert.equal(second.result, "loss");
});
