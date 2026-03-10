import type { RedisLikeClient } from "../lib/server/odds/persistence";

export function createMockRedis(): {
  client: RedisLikeClient;
  store: Map<string, unknown>;
  setCalls: Array<{ key: string; ex?: number }>;
} {
  const store = new Map<string, unknown>();
  const setCalls: Array<{ key: string; ex?: number }> = [];

  const client: RedisLikeClient = {
    get: async <T>(key: string) => {
      if (!store.has(key)) return null;
      return store.get(key) as T;
    },
    set: async (key: string, value: unknown, options?: { ex?: number }) => {
      setCalls.push({ key, ex: options?.ex });
      store.set(key, value);
      return "OK";
    },
    del: async (key: string) => {
      store.delete(key);
      return 1;
    }
  };

  return {
    client,
    store,
    setCalls
  };
}
