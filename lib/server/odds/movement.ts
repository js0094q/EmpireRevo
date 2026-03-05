import { getRedis } from "@/lib/server/odds/redis";

type MovementSnapshot = {
  openPrice: number;
  prevPrice: number;
  currentPrice: number;
  updatedAt: string;
};

const memoryState = new Map<string, MovementSnapshot>();

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function trackMovement(key: string, currentPrice: number): Promise<MovementSnapshot & { delta: number; move: number }> {
  const redis = getRedis();
  const nowIso = new Date().toISOString();

  if (!redis) {
    const prev = memoryState.get(key);
    const snapshot: MovementSnapshot = prev
      ? {
          openPrice: prev.openPrice,
          prevPrice: prev.currentPrice,
          currentPrice,
          updatedAt: nowIso
        }
      : {
          openPrice: currentPrice,
          prevPrice: currentPrice,
          currentPrice,
          updatedAt: nowIso
        };

    memoryState.set(key, snapshot);
    return {
      ...snapshot,
      delta: snapshot.currentPrice - snapshot.prevPrice,
      move: snapshot.currentPrice - snapshot.openPrice
    };
  }

  const redisKey = `movement:${key}`;
  const existing = await redis.hgetall<Record<string, string | number>>(redisKey);

  const openPrice = existing?.openPrice !== undefined ? toNumber(existing.openPrice, currentPrice) : currentPrice;
  const prevPrice = existing?.currentPrice !== undefined ? toNumber(existing.currentPrice, currentPrice) : currentPrice;

  await redis.hset(redisKey, {
    openPrice,
    prevPrice,
    currentPrice,
    updatedAt: nowIso
  });
  await redis.expire(redisKey, 60 * 60 * 24 * 2);

  return {
    openPrice,
    prevPrice,
    currentPrice,
    updatedAt: nowIso,
    delta: currentPrice - prevPrice,
    move: currentPrice - openPrice
  };
}
