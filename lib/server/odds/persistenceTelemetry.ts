import { getRedis } from "@/lib/server/odds/redis";
import { getPersistenceTtls } from "@/lib/server/odds/persistenceConfig";

export type PersistenceTelemetry = {
  version: 1;
  updatedAt: number;
  writesAttempted: number;
  writesSucceeded: number;
  writesFailed: number;
  fallbackWrites: number;
  avgSnapshotPayloadBytes: number;
  avgValidationPayloadBytes: number;
  recentReadFailures: number;
  recentWriteFailures: number;
  namespacesTouched: string[];
  avgTimelineReadLatencyMs: number;
  avgValidationReadLatencyMs: number;
};

type MutableTelemetry = PersistenceTelemetry & {
  snapshotPayloadSamples: number;
  validationPayloadSamples: number;
  timelineReadSamples: number;
  validationReadSamples: number;
  namespaceSet: Set<string>;
};

const TELEMETRY_KEY = "empire:telemetry:persistence:v1";
const PERSIST_INTERVAL_MS = 5_000;

const state: MutableTelemetry = {
  version: 1,
  updatedAt: Date.now(),
  writesAttempted: 0,
  writesSucceeded: 0,
  writesFailed: 0,
  fallbackWrites: 0,
  avgSnapshotPayloadBytes: 0,
  avgValidationPayloadBytes: 0,
  recentReadFailures: 0,
  recentWriteFailures: 0,
  namespacesTouched: [],
  avgTimelineReadLatencyMs: 0,
  avgValidationReadLatencyMs: 0,
  snapshotPayloadSamples: 0,
  validationPayloadSamples: 0,
  timelineReadSamples: 0,
  validationReadSamples: 0,
  namespaceSet: new Set<string>()
};

let persistInFlight = false;
let lastPersistAt = 0;

function touchNamespace(namespace: string): void {
  if (!namespace) return;
  state.namespaceSet.add(namespace);
  state.namespacesTouched = Array.from(state.namespaceSet).sort();
}

function touch(): void {
  state.updatedAt = Date.now();
}

function rollingAverage(currentAverage: number, samples: number, nextValue: number): number {
  if (samples <= 0) return nextValue;
  return (currentAverage * samples + nextValue) / (samples + 1);
}

function buildSnapshot(): PersistenceTelemetry {
  return {
    version: 1,
    updatedAt: state.updatedAt,
    writesAttempted: state.writesAttempted,
    writesSucceeded: state.writesSucceeded,
    writesFailed: state.writesFailed,
    fallbackWrites: state.fallbackWrites,
    avgSnapshotPayloadBytes: state.avgSnapshotPayloadBytes,
    avgValidationPayloadBytes: state.avgValidationPayloadBytes,
    recentReadFailures: state.recentReadFailures,
    recentWriteFailures: state.recentWriteFailures,
    namespacesTouched: [...state.namespacesTouched],
    avgTimelineReadLatencyMs: state.avgTimelineReadLatencyMs,
    avgValidationReadLatencyMs: state.avgValidationReadLatencyMs
  };
}

async function persistTelemetry(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  if (persistInFlight) return;

  const now = Date.now();
  if (now - lastPersistAt < PERSIST_INTERVAL_MS) return;

  persistInFlight = true;
  lastPersistAt = now;
  try {
    const ttls = getPersistenceTtls();
    await redis.set(TELEMETRY_KEY, buildSnapshot(), { ex: Math.max(1, ttls.diagnosticsSeconds) });
  } catch {
    // Telemetry is best-effort and must never block caller paths.
  } finally {
    persistInFlight = false;
  }
}

function schedulePersist(): void {
  void persistTelemetry();
}

export function inferNamespaceFromKey(key: string): string {
  if (!key) return "unknown";
  const parts = key.split(":").filter(Boolean);
  if (parts.length < 3) return parts[0] || "unknown";
  return parts.slice(0, 3).join(":");
}

export function recordWriteAttempt(namespace: string): void {
  touchNamespace(namespace);
  state.writesAttempted += 1;
  touch();
}

export function recordWriteSuccess(namespace: string, fallback = false): void {
  touchNamespace(namespace);
  state.writesSucceeded += 1;
  if (fallback) {
    state.fallbackWrites += 1;
  }
  touch();
  schedulePersist();
}

export function recordWriteFailure(namespace: string): void {
  touchNamespace(namespace);
  state.writesFailed += 1;
  state.recentWriteFailures += 1;
  touch();
  schedulePersist();
}

export function recordReadFailure(namespace: string): void {
  touchNamespace(namespace);
  state.recentReadFailures += 1;
  touch();
  schedulePersist();
}

export function recordPayloadSample(kind: "snapshot" | "validation", bytes: number): void {
  if (!Number.isFinite(bytes) || bytes <= 0) return;
  if (kind === "snapshot") {
    state.avgSnapshotPayloadBytes = rollingAverage(state.avgSnapshotPayloadBytes, state.snapshotPayloadSamples, bytes);
    state.snapshotPayloadSamples += 1;
  } else {
    state.avgValidationPayloadBytes = rollingAverage(state.avgValidationPayloadBytes, state.validationPayloadSamples, bytes);
    state.validationPayloadSamples += 1;
  }
  touch();
  schedulePersist();
}

export function recordTimelineReadLatency(ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) return;
  state.avgTimelineReadLatencyMs = rollingAverage(state.avgTimelineReadLatencyMs, state.timelineReadSamples, ms);
  state.timelineReadSamples += 1;
  touch();
  schedulePersist();
}

export function recordValidationReadLatency(ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) return;
  state.avgValidationReadLatencyMs = rollingAverage(state.avgValidationReadLatencyMs, state.validationReadSamples, ms);
  state.validationReadSamples += 1;
  touch();
  schedulePersist();
}

export function getPersistenceTelemetrySnapshot(): PersistenceTelemetry {
  return buildSnapshot();
}

export async function readPersistenceTelemetry(): Promise<PersistenceTelemetry> {
  const redis = getRedis();
  if (!redis) {
    return buildSnapshot();
  }

  try {
    const persisted = await redis.get<PersistenceTelemetry>(TELEMETRY_KEY);
    if (persisted && persisted.updatedAt > state.updatedAt) {
      return persisted;
    }
  } catch {
    // Fall through to in-memory snapshot.
  }

  return buildSnapshot();
}

export function resetPersistenceTelemetryForTests(): void {
  state.updatedAt = Date.now();
  state.writesAttempted = 0;
  state.writesSucceeded = 0;
  state.writesFailed = 0;
  state.fallbackWrites = 0;
  state.avgSnapshotPayloadBytes = 0;
  state.avgValidationPayloadBytes = 0;
  state.recentReadFailures = 0;
  state.recentWriteFailures = 0;
  state.namespacesTouched = [];
  state.avgTimelineReadLatencyMs = 0;
  state.avgValidationReadLatencyMs = 0;
  state.snapshotPayloadSamples = 0;
  state.validationPayloadSamples = 0;
  state.timelineReadSamples = 0;
  state.validationReadSamples = 0;
  state.namespaceSet.clear();
  persistInFlight = false;
  lastPersistAt = 0;
}
