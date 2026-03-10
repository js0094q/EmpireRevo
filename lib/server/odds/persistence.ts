import { getRedis, hasRedisConfig } from "@/lib/server/odds/redis";
import {
  inferNamespaceFromKey,
  recordReadFailure,
  recordWriteAttempt,
  recordWriteFailure,
  recordWriteSuccess,
  resetPersistenceTelemetryForTests
} from "@/lib/server/odds/persistenceTelemetry";

export type RedisLikeClient = {
  get: <T>(key: string) => Promise<T | null>;
  set: (key: string, value: unknown, options?: { ex?: number }) => Promise<unknown>;
  del?: (key: string) => Promise<unknown>;
};

type MemoryEntry = {
  value: unknown;
  expiresAt: number;
};

export type PersistenceStatus = {
  mode: "redis" | "memory";
  durable: boolean;
  configured: boolean;
  memoryKeys: number;
};

const memoryStore = new Map<string, MemoryEntry>();
let redisOverride: RedisLikeClient | null | undefined;

function nowMs(): number {
  return Date.now();
}

function pruneExpiredMemory(): void {
  const now = nowMs();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.expiresAt <= now) {
      memoryStore.delete(key);
    }
  }
}

function memoryGet<T>(key: string): T | null {
  pruneExpiredMemory();
  const entry = memoryStore.get(key);
  if (!entry) return null;
  return entry.value as T;
}

function memorySet<T>(key: string, value: T, ttlSeconds: number): void {
  const ttlMs = Math.max(1, Math.floor(ttlSeconds)) * 1000;
  memoryStore.set(key, {
    value,
    expiresAt: nowMs() + ttlMs
  });
}

function resolveRedis(): RedisLikeClient | null {
  if (redisOverride !== undefined) {
    return redisOverride;
  }
  const redis = getRedis();
  if (!redis) return null;

  return {
    get: async <T>(key: string) => redis.get<T>(key),
    set: async (key: string, value: unknown, options?: { ex?: number }) => {
      const ex = options?.ex;
      if (Number.isFinite(ex)) {
        return redis.set(key, value, { ex: Math.max(1, Math.floor(ex as number)) });
      }
      return redis.set(key, value);
    },
    del: async (key: string) => redis.del(key)
  };
}

export function getPersistenceStatus(): PersistenceStatus {
  const redis = resolveRedis();
  pruneExpiredMemory();
  return {
    mode: redis ? "redis" : "memory",
    durable: Boolean(redis),
    configured: hasRedisConfig(),
    memoryKeys: memoryStore.size
  };
}

export async function persistenceGetJson<T>(key: string): Promise<T | null> {
  const namespace = inferNamespaceFromKey(key);
  const redis = resolveRedis();
  if (!redis) return memoryGet<T>(key);

  try {
    const value = await redis.get<T>(key);
    if (value !== null && value !== undefined) {
      return value;
    }
  } catch {
    recordReadFailure(namespace);
    return memoryGet<T>(key);
  }

  return memoryGet<T>(key);
}

export async function persistenceSetJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const namespace = inferNamespaceFromKey(key);
  recordWriteAttempt(namespace);
  const redis = resolveRedis();
  if (!redis) {
    memorySet(key, value, ttlSeconds);
    recordWriteSuccess(namespace, true);
    return;
  }

  try {
    await redis.set(key, value, { ex: Math.max(1, Math.floor(ttlSeconds)) });
    recordWriteSuccess(namespace, false);
    return;
  } catch {
    recordWriteFailure(namespace);
    memorySet(key, value, ttlSeconds);
    recordWriteSuccess(namespace, true);
  }
}

export async function persistenceDelete(key: string): Promise<void> {
  const redis = resolveRedis();
  memoryStore.delete(key);
  if (!redis || !redis.del) return;
  try {
    await redis.del(key);
  } catch {
    // Persistence is best effort and should not break callers.
  }
}

export async function persistenceGetManyJson<T>(keys: string[]): Promise<Map<string, T>> {
  const out = new Map<string, T>();
  await Promise.all(
    keys.map(async (key) => {
      const value = await persistenceGetJson<T>(key);
      if (value !== null) {
        out.set(key, value);
      }
    })
  );
  return out;
}

export async function persistenceMutateJson<T>(
  key: string,
  ttlSeconds: number,
  updater: (existing: T | null) => T
): Promise<T> {
  const next = updater(await persistenceGetJson<T>(key));
  await persistenceSetJson(key, next, ttlSeconds);
  return next;
}

export function resetPersistenceForTests(): void {
  memoryStore.clear();
  redisOverride = undefined;
  resetPersistenceTelemetryForTests();
}

export function setRedisOverrideForTests(client: RedisLikeClient | null | undefined): void {
  redisOverride = client;
}

export function getMemoryEntryForTests(key: string): MemoryEntry | null {
  pruneExpiredMemory();
  return memoryStore.get(key) || null;
}
