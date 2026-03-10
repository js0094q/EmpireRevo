import test from "node:test";
import assert from "node:assert/strict";
import { createMockRedis } from "./mockRedis";
import {
  getMemoryEntryForTests,
  persistenceGetJson,
  persistenceSetJson,
  resetPersistenceForTests,
  setRedisOverrideForTests
} from "../lib/server/odds/persistence";

test.beforeEach(() => {
  resetPersistenceForTests();
});

test("persistence writes and reads in memory fallback", async () => {
  await persistenceSetJson("persist:test:memory", { ok: true, version: 1 }, 30);
  const value = await persistenceGetJson<{ ok: boolean; version: number }>("persist:test:memory");
  assert.deepEqual(value, { ok: true, version: 1 });

  const entry = getMemoryEntryForTests("persist:test:memory");
  assert.ok(entry);
  assert.ok((entry?.expiresAt || 0) > Date.now());
});

test("persistence uses redis adapter when configured", async () => {
  const mockRedis = createMockRedis();
  setRedisOverrideForTests(mockRedis.client);

  await persistenceSetJson("persist:test:redis", { sample: 42 }, 77);
  const value = await persistenceGetJson<{ sample: number }>("persist:test:redis");

  assert.deepEqual(value, { sample: 42 });
  assert.equal(mockRedis.setCalls.length, 1);
  assert.equal(mockRedis.setCalls[0]?.key, "persist:test:redis");
  assert.equal(mockRedis.setCalls[0]?.ex, 77);
});
