import { cacheGet, cacheKey, cacheSet } from "@/lib/server/odds/cache";

const DEFAULT_TTL_MS = 30_000;

export async function withOddsCache<T>(
  parts: Array<string | number | undefined>,
  loader: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS
): Promise<T> {
  const key = cacheKey(parts);
  const cached = await cacheGet<T>(key);
  if (cached) return cached;
  const fresh = await loader();
  await cacheSet(key, fresh, ttlMs);
  return fresh;
}

export { cacheKey as buildOddsCacheKey } from "@/lib/server/odds/cache";
