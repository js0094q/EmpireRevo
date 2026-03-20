type Bucket = {
  count: number;
  resetAtMs: number;
};

export type FallbackRateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
};

const memoryBuckets = new Map<string, Bucket>();
const MAX_BUCKETS = 2048;

function cleanupExpiredBuckets(nowMs: number): void {
  if (memoryBuckets.size <= MAX_BUCKETS) return;
  for (const [key, bucket] of memoryBuckets.entries()) {
    if (bucket.resetAtMs <= nowMs) {
      memoryBuckets.delete(key);
    }
  }
}

export function applyFallbackRateLimit(params: {
  key: string;
  limit: number;
  windowSec: number;
  nowMs?: number;
}): FallbackRateLimitResult {
  const now = params.nowMs ?? Date.now();
  const windowMs = params.windowSec * 1000;
  const existing = memoryBuckets.get(params.key);

  if (!existing || existing.resetAtMs <= now) {
    const next: Bucket = { count: 1, resetAtMs: now + windowMs };
    memoryBuckets.set(params.key, next);
    cleanupExpiredBuckets(now);
    return {
      success: true,
      limit: params.limit,
      remaining: Math.max(0, params.limit - next.count),
      reset: Math.floor(next.resetAtMs / 1000)
    };
  }

  if (existing.count >= params.limit) {
    return {
      success: false,
      limit: params.limit,
      remaining: 0,
      reset: Math.floor(existing.resetAtMs / 1000)
    };
  }

  existing.count += 1;
  return {
    success: true,
    limit: params.limit,
    remaining: Math.max(0, params.limit - existing.count),
    reset: Math.floor(existing.resetAtMs / 1000)
  };
}

export function resetFallbackRateLimitForTests(): void {
  memoryBuckets.clear();
}
