import { getPersistenceTtls } from "@/lib/server/odds/persistenceConfig";
import { persistenceGetJson, persistenceMutateJson, persistenceSetJson } from "@/lib/server/odds/persistence";
import type { OutcomeResult, PersistedOutcomeResult } from "@/lib/server/odds/types";

const OUTCOME_VERSION = 1 as const;
const MAX_INDEX_DAYS = 120;
const MAX_IDS_PER_DAY = 4000;
const OUTCOME_DAY_INDEX_KEY = "empire:outcomes:index:days";

function utcDateBucket(ts: number): string {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = `${d.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${d.getUTCDate()}`.padStart(2, "0");
  return `${y}${m}${day}`;
}

function normalizePart(value: string | null | undefined): string {
  const normalized = (value || "unknown").trim().toLowerCase();
  return normalized || "unknown";
}

export function buildOutcomeLookupKey(params: {
  sportKey: string;
  eventId: string;
  marketKey: string;
  sideKey: string;
}): string {
  const sportKey = normalizePart(params.sportKey);
  const eventId = normalizePart(params.eventId);
  const marketKey = normalizePart(params.marketKey);
  const sideKey = normalizePart(params.sideKey);
  return `${sportKey}:${eventId}:${marketKey}:${sideKey}`;
}

export function buildOutcomeResultKey(params: {
  sportKey: string;
  eventId: string;
  marketKey: string;
  sideKey: string;
}): string {
  return `empire:outcome:event:${buildOutcomeLookupKey(params)}`;
}

function buildOutcomeDailyIndexKey(dateBucket: string): string {
  return `empire:outcome:index:${dateBucket}`;
}

function normalizeResult(result: OutcomeResult): OutcomeResult {
  if (result === "win" || result === "loss" || result === "push" || result === "void" || result === "unknown") {
    return result;
  }
  return "unknown";
}

async function appendIdToDailyIndex(id: string, ts: number, ttlSeconds: number): Promise<void> {
  const dateBucket = utcDateBucket(ts);

  await persistenceMutateJson<string[]>(OUTCOME_DAY_INDEX_KEY, ttlSeconds, (existing) => {
    const prior = existing || [];
    const without = prior.filter((bucket) => bucket !== dateBucket);
    return [...without, dateBucket].slice(-MAX_INDEX_DAYS);
  });

  await persistenceMutateJson<string[]>(buildOutcomeDailyIndexKey(dateBucket), ttlSeconds, (existing) => {
    const prior = existing || [];
    const deduped = prior.filter((entry) => entry !== id);
    return [...deduped, id].slice(-MAX_IDS_PER_DAY);
  });
}

async function collectIdsByRecency(limit: number): Promise<string[]> {
  const safeLimit = Math.max(1, Math.floor(limit));
  const dayBuckets = (await persistenceGetJson<string[]>(OUTCOME_DAY_INDEX_KEY)) || [];
  const ids: string[] = [];
  const seen = new Set<string>();

  for (let idx = dayBuckets.length - 1; idx >= 0 && ids.length < safeLimit; idx -= 1) {
    const dayBucket = dayBuckets[idx];
    if (!dayBucket) continue;

    const dayIds = (await persistenceGetJson<string[]>(buildOutcomeDailyIndexKey(dayBucket))) || [];
    for (let dayIdx = dayIds.length - 1; dayIdx >= 0 && ids.length < safeLimit; dayIdx -= 1) {
      const id = dayIds[dayIdx];
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }

  return ids;
}

export type PersistOutcomeParams = {
  sportKey: string;
  eventId: string;
  marketKey: string;
  sideKey: string;
  result: OutcomeResult;
  finalScore?: string | null;
  closeTimestamp?: string | null;
  source?: PersistedOutcomeResult["source"];
  updatedAt?: number;
};

export async function persistOutcomeResult(params: PersistOutcomeParams): Promise<PersistedOutcomeResult> {
  const now = Number.isFinite(params.updatedAt) ? Number(params.updatedAt) : Date.now();
  const id = buildOutcomeLookupKey(params);
  const key = buildOutcomeResultKey(params);
  const ttls = getPersistenceTtls();
  const existing = await persistenceGetJson<PersistedOutcomeResult>(key);

  const payload: PersistedOutcomeResult = {
    version: OUTCOME_VERSION,
    id,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    sportKey: normalizePart(params.sportKey),
    eventId: normalizePart(params.eventId),
    marketKey: normalizePart(params.marketKey),
    sideKey: normalizePart(params.sideKey),
    result: normalizeResult(params.result),
    finalScore: params.finalScore ?? null,
    closeTimestamp: params.closeTimestamp ?? null,
    source: params.source || "unknown"
  };

  await persistenceSetJson(key, payload, ttls.evaluationSeconds);
  await appendIdToDailyIndex(id, now, ttls.evaluationSeconds);
  return payload;
}

export async function getOutcomeResult(params: {
  sportKey: string;
  eventId: string;
  marketKey: string;
  sideKey: string;
}): Promise<PersistedOutcomeResult | null> {
  const key = buildOutcomeResultKey(params);
  return persistenceGetJson<PersistedOutcomeResult>(key);
}

export async function listOutcomeResults(limit = 500): Promise<PersistedOutcomeResult[]> {
  const ids = await collectIdsByRecency(limit);
  const keys = ids.map((id) => `empire:outcome:event:${id}`);
  const rows = await Promise.all(keys.map((key) => persistenceGetJson<PersistedOutcomeResult>(key)));
  return rows.filter((entry): entry is PersistedOutcomeResult => Boolean(entry));
}
