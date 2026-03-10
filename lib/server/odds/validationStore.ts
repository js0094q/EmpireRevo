import type { PersistedEvaluationResult, PersistedValidationEvent } from "@/lib/server/odds/types";
import { getPersistenceTtls } from "@/lib/server/odds/persistenceConfig";
import { persistenceGetJson, persistenceMutateJson, persistenceSetJson } from "@/lib/server/odds/persistence";
import { recordPayloadSample, recordValidationReadLatency } from "@/lib/server/odds/persistenceTelemetry";

const VALIDATION_VERSION = 1 as const;
const EVALUATION_VERSION = 1 as const;
const MAX_INDEX_DAYS = 120;
const MAX_IDS_PER_DAY = 4000;
const DAY_INDEX_KEY = "empire:validation:index:days";
const EVALUATION_DAY_INDEX_KEY = "empire:evaluation:index:days";

function utcDateBucket(ts: number): string {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = `${d.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${d.getUTCDate()}`.padStart(2, "0");
  return `${y}${m}${day}`;
}

export function buildValidationEventKey(id: string): string {
  return `empire:validation:event:${id}`;
}

export function buildValidationIndexKey(dateBucket: string): string {
  return `empire:validation:index:${dateBucket}`;
}

export function buildEvaluationEventKey(id: string): string {
  return `empire:evaluation:event:${id}`;
}

export function buildEvaluationIndexKey(dateBucket: string): string {
  return `empire:evaluation:index:${dateBucket}`;
}

export function buildClosingEvaluationKey(sportKey: string, eventId: string, marketKey: string): string {
  return `empire:evaluation:closing:${sportKey}:${eventId}:${marketKey}`;
}

export function buildDiagnosticsFactorKey(dateBucket: string): string {
  return `empire:diagnostics:factor:${dateBucket}`;
}

async function appendIdToDailyIndex(params: {
  id: string;
  ts: number;
  dayIndexRootKey: string;
  dayKeyBuilder: (bucket: string) => string;
  ttlSeconds: number;
}): Promise<void> {
  const dateBucket = utcDateBucket(params.ts);

  await persistenceMutateJson<string[]>(params.dayIndexRootKey, params.ttlSeconds, (existing) => {
    const prior = existing || [];
    const without = prior.filter((bucket) => bucket !== dateBucket);
    return [...without, dateBucket].slice(-MAX_INDEX_DAYS);
  });

  await persistenceMutateJson<string[]>(params.dayKeyBuilder(dateBucket), params.ttlSeconds, (existing) => {
    const prior = existing || [];
    const deduped = prior.filter((entry) => entry !== params.id);
    return [...deduped, params.id].slice(-MAX_IDS_PER_DAY);
  });
}

async function collectIdsByRecency(params: {
  limit: number;
  dayIndexRootKey: string;
  dayKeyBuilder: (bucket: string) => string;
}): Promise<string[]> {
  const safeLimit = Math.max(1, Math.floor(params.limit));
  const dayBuckets = (await persistenceGetJson<string[]>(params.dayIndexRootKey)) || [];
  const ids: string[] = [];
  const seen = new Set<string>();

  for (let idx = dayBuckets.length - 1; idx >= 0 && ids.length < safeLimit; idx -= 1) {
    const dayBucket = dayBuckets[idx];
    if (!dayBucket) continue;
    const dayIds = (await persistenceGetJson<string[]>(params.dayKeyBuilder(dayBucket))) || [];
    for (let dayIdx = dayIds.length - 1; dayIdx >= 0 && ids.length < safeLimit; dayIdx -= 1) {
      const id = dayIds[dayIdx];
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }

  return ids;
}

export async function persistValidationEvent(event: PersistedValidationEvent): Promise<void> {
  const ttls = getPersistenceTtls();
  const payload: PersistedValidationEvent = {
    ...event,
    version: VALIDATION_VERSION
  };
  recordPayloadSample("validation", JSON.stringify(payload).length);

  await persistenceSetJson(buildValidationEventKey(event.id), payload, ttls.validationEventSeconds);
  await appendIdToDailyIndex({
    id: event.id,
    ts: event.createdAt,
    dayIndexRootKey: DAY_INDEX_KEY,
    dayKeyBuilder: buildValidationIndexKey,
    ttlSeconds: ttls.validationEventSeconds
  });
}

export async function getValidationEvent(id: string): Promise<PersistedValidationEvent | null> {
  return persistenceGetJson<PersistedValidationEvent>(buildValidationEventKey(id));
}

export async function listValidationEvents(limit = 200): Promise<PersistedValidationEvent[]> {
  const startedAt = Date.now();
  const ids = await collectIdsByRecency({
    limit,
    dayIndexRootKey: DAY_INDEX_KEY,
    dayKeyBuilder: buildValidationIndexKey
  });

  const events = await Promise.all(ids.map((id) => getValidationEvent(id)));
  recordValidationReadLatency(Date.now() - startedAt);
  return events.filter((entry): entry is PersistedValidationEvent => Boolean(entry));
}

export async function persistEvaluationResult(result: PersistedEvaluationResult): Promise<void> {
  const ttls = getPersistenceTtls();
  const payload: PersistedEvaluationResult = {
    ...result,
    version: EVALUATION_VERSION
  };

  await persistenceSetJson(buildEvaluationEventKey(result.id), payload, ttls.evaluationSeconds);
  await persistenceSetJson(
    buildClosingEvaluationKey(result.sportKey, result.eventId, result.marketKey),
    {
      version: 1,
      createdAt: result.createdAt,
      eventId: result.eventId,
      marketKey: result.marketKey,
      close: result.close
    },
    ttls.evaluationSeconds
  );

  await appendIdToDailyIndex({
    id: result.id,
    ts: result.createdAt,
    dayIndexRootKey: EVALUATION_DAY_INDEX_KEY,
    dayKeyBuilder: buildEvaluationIndexKey,
    ttlSeconds: ttls.evaluationSeconds
  });
}

export async function getEvaluationResult(id: string): Promise<PersistedEvaluationResult | null> {
  return persistenceGetJson<PersistedEvaluationResult>(buildEvaluationEventKey(id));
}

export async function listEvaluationResults(limit = 200): Promise<PersistedEvaluationResult[]> {
  const ids = await collectIdsByRecency({
    limit,
    dayIndexRootKey: EVALUATION_DAY_INDEX_KEY,
    dayKeyBuilder: buildEvaluationIndexKey
  });

  const results = await Promise.all(ids.map((id) => getEvaluationResult(id)));
  return results.filter((entry): entry is PersistedEvaluationResult => Boolean(entry));
}

export async function getClosingEvaluation(
  sportKey: string,
  eventId: string,
  marketKey: string
): Promise<{
  version: 1;
  createdAt: number;
  eventId: string;
  marketKey: string;
  close: PersistedEvaluationResult["close"];
} | null> {
  return persistenceGetJson(buildClosingEvaluationKey(sportKey, eventId, marketKey));
}

export async function writeFactorDiagnostics(dateBucket: string, payload: unknown): Promise<void> {
  const ttls = getPersistenceTtls();
  await persistenceSetJson(buildDiagnosticsFactorKey(dateBucket), payload, ttls.diagnosticsSeconds);
}

export async function readFactorDiagnostics<T>(dateBucket: string): Promise<T | null> {
  return persistenceGetJson<T>(buildDiagnosticsFactorKey(dateBucket));
}

export function validationDateBucket(ts: number): string {
  return utcDateBucket(ts);
}
