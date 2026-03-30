import { cacheProviderName, getRedis } from "@/lib/server/odds/redis";

type Entry<T> = {
  value: T;
  expiresAt: number;
};

const memoryStore = new Map<string, Entry<unknown>>();

export function cacheKey(parts: Array<string | number | undefined>): string {
  return parts
    .map((part) => (part === undefined ? "" : String(part)))
    .join("|");
}

function memoryGet<T>(key: string): T | null {
  const hit = memoryStore.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return hit.value as T;
}

function memorySet<T>(key: string, value: T, ttlMs: number): void {
  memoryStore.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return memoryGet<T>(key);

  try {
    const value = await redis.get<T>(`cache:${key}`);
    return value || null;
  } catch {
    return memoryGet<T>(key);
  }
}

export async function cacheSet<T>(key: string, value: T, ttlMs: number): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    memorySet(key, value, ttlMs);
    return;
  }

  try {
    await redis.set(`cache:${key}`, value, { ex: Math.max(1, Math.floor(ttlMs / 1000)) });
  } catch {
    memorySet(key, value, ttlMs);
  }
}

export function cacheStatus(): { provider: "redis" | "memory"; memoryEntries: number } {
  return {
    provider: cacheProviderName(),
    memoryEntries: memoryStore.size
  };
}

export function resetCacheForTests(): void {
  memoryStore.clear();
}
