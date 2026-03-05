import { getRedis } from "@/lib/server/odds/redis";

export type MovementHistoryPoint = {
  ts: string;
  priceAmerican: number;
};

type MovementSnapshot = {
  openPrice: number;
  prevPrice: number;
  currentPrice: number;
  updatedAt: string;
  history: MovementHistoryPoint[];
};

const memoryState = new Map<string, MovementSnapshot>();

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

type TrackOptions = {
  windowMs?: number;
  retentionMs?: number;
  maxPoints?: number;
};

const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RETENTION_MS = 72 * 60 * 60 * 1000;
const DEFAULT_MAX_POINTS = 800;
const HISTORY_INDEX_KEY = "movement:v2:index";

function clampPositiveInt(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value) || (value as number) <= 0) return fallback;
  return Math.floor(value as number);
}

export function foldHistory(params: {
  previous?: MovementSnapshot;
  currentPrice: number;
  nowIso: string;
  windowMs: number;
  retentionMs: number;
  maxPoints: number;
}): MovementSnapshot & { delta: number; move: number } {
  const nowMs = Date.parse(params.nowIso);
  const minKeep = nowMs - params.retentionMs;
  const minWindow = nowMs - params.windowMs;

  const prev = params.previous;
  const openPrice = prev ? prev.openPrice : params.currentPrice;
  const prevPrice = prev ? prev.currentPrice : params.currentPrice;

  const baseHistory = (prev?.history || []).filter((point) => {
    const ts = Date.parse(point.ts);
    return Number.isFinite(ts) && ts >= minKeep;
  });

  const lastPoint = baseHistory.at(-1);
  if (!lastPoint || lastPoint.priceAmerican !== params.currentPrice) {
    baseHistory.push({ ts: params.nowIso, priceAmerican: params.currentPrice });
  }

  const trimmed = baseHistory.slice(-params.maxPoints);
  const windowedHistory = trimmed.filter((point) => {
    const ts = Date.parse(point.ts);
    return Number.isFinite(ts) && ts >= minWindow;
  });

  return {
    openPrice,
    prevPrice,
    currentPrice: params.currentPrice,
    updatedAt: params.nowIso,
    history: windowedHistory,
    delta: params.currentPrice - prevPrice,
    move: params.currentPrice - openPrice
  };
}

export async function trackMovement(
  key: string,
  currentPrice: number,
  options: TrackOptions = {}
): Promise<MovementSnapshot & { delta: number; move: number }> {
  const redis = getRedis();
  const nowIso = new Date().toISOString();
  const windowMs = clampPositiveInt(options.windowMs, DEFAULT_WINDOW_MS);
  const retentionMs = clampPositiveInt(options.retentionMs, DEFAULT_RETENTION_MS);
  const maxPoints = clampPositiveInt(options.maxPoints, DEFAULT_MAX_POINTS);

  if (!redis) {
    const prev = memoryState.get(key);
    const persisted = foldHistory({
      previous: prev,
      currentPrice,
      nowIso,
      windowMs: retentionMs,
      retentionMs,
      maxPoints
    });
    memoryState.set(key, {
      openPrice: persisted.openPrice,
      prevPrice: persisted.prevPrice,
      currentPrice: persisted.currentPrice,
      updatedAt: persisted.updatedAt,
      history: persisted.history
    });
    const historySince = Date.parse(nowIso) - windowMs;
    const history = persisted.history.filter((point) => {
      const ts = Date.parse(point.ts);
      return Number.isFinite(ts) && ts >= historySince;
    });
    return {
      ...persisted,
      history
    };
  }

  const redisKey = `movement:v2:${key}`;
  const existing = await redis.get<MovementSnapshot>(redisKey);

  const normalizedPrevious: MovementSnapshot | undefined = existing
    ? {
        openPrice: toNumber(existing.openPrice, currentPrice),
        prevPrice: toNumber(existing.prevPrice, currentPrice),
        currentPrice: toNumber(existing.currentPrice, currentPrice),
        updatedAt: typeof existing.updatedAt === "string" ? existing.updatedAt : nowIso,
        history: Array.isArray(existing.history)
          ? existing.history
              .map((point) => ({
                ts: String(point.ts),
                priceAmerican: toNumber(point.priceAmerican, currentPrice)
              }))
              .filter((point) => Boolean(point.ts))
          : []
      }
    : undefined;

  const persisted = foldHistory({
    previous: normalizedPrevious,
    currentPrice,
    nowIso,
    windowMs: retentionMs,
    retentionMs,
    maxPoints
  });

  const payload: MovementSnapshot = {
    openPrice: persisted.openPrice,
    prevPrice: persisted.prevPrice,
    currentPrice: persisted.currentPrice,
    updatedAt: persisted.updatedAt,
    history: persisted.history
  };

  await redis.set(redisKey, payload, { ex: Math.max(1, Math.floor(retentionMs / 1000)) });
  await redis.sadd(HISTORY_INDEX_KEY, key);

  const historySince = Date.parse(nowIso) - windowMs;
  const history = persisted.history.filter((point) => {
    const ts = Date.parse(point.ts);
    return Number.isFinite(ts) && ts >= historySince;
  });

  return {
    ...payload,
    history,
    delta: currentPrice - payload.prevPrice,
    move: currentPrice - payload.openPrice
  };
}
