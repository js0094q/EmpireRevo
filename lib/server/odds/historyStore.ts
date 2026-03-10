import type { PersistedMarketSnapshot } from "@/lib/server/odds/types";
import { getPersistenceTtls } from "@/lib/server/odds/persistenceConfig";
import { persistenceGetJson, persistenceMutateJson, persistenceSetJson } from "@/lib/server/odds/persistence";
import { recordPayloadSample, recordTimelineReadLatency } from "@/lib/server/odds/persistenceTelemetry";

export type StoredTimelineBook = {
  bookKey: string;
  american?: number | null;
  isSharp?: boolean;
  isPinned?: boolean;
};

export type StoredTimelinePoint = {
  ts: number;
  snapshotKey: string;
  fairAmerican?: number | null;
  globalBestAmerican?: number | null;
  pinnedBestAmerican?: number | null;
  books: StoredTimelineBook[];
};

export type StoredMarketTimeline = {
  version: 1;
  sportKey: string;
  eventId: string;
  marketKey: string;
  points: StoredTimelinePoint[];
};

export type SnapshotRef = {
  key: string;
  bucketTs: number;
};

const SNAPSHOT_VERSION = 1 as const;
const TIMELINE_VERSION = 1 as const;
const DEFAULT_BUCKET_MS = 60 * 1000;
const MAX_TIMELINE_POINTS = 5000;

function bestAmerican(values: Array<number | null | undefined>): number | null {
  const finite = values.filter((value): value is number => Number.isFinite(value));
  if (!finite.length) return null;
  return finite.reduce((best, value) => (value > best ? value : best), finite[0]!);
}

function asBookAmerican(snapshot: PersistedMarketSnapshot): StoredTimelineBook[] {
  return snapshot.books.map((book) => ({
    bookKey: book.bookKey,
    american: book.outcomes[0]?.priceAmerican ?? null,
    isSharp: Boolean(book.isSharp),
    isPinned: Boolean(book.isPinned)
  }));
}

function timelinePoint(snapshot: PersistedMarketSnapshot, snapshotKey: string): StoredTimelinePoint {
  const books = asBookAmerican(snapshot);
  const globalBestAmerican = bestAmerican(books.map((book) => book.american));
  const pinnedBestAmerican = bestAmerican(books.filter((book) => book.isPinned).map((book) => book.american));

  return {
    ts: snapshot.capturedAt,
    snapshotKey,
    fairAmerican: snapshot.fair?.fairAmerican ?? null,
    globalBestAmerican,
    pinnedBestAmerican,
    books
  };
}

export function buildSnapshotKey(sportKey: string, eventId: string, marketKey: string, bucketTs: number): string {
  return `empire:odds:snapshot:${sportKey}:${eventId}:${marketKey}:${bucketTs}`;
}

export function buildTimelineKey(sportKey: string, eventId: string, marketKey: string): string {
  return `empire:odds:timeline:${sportKey}:${eventId}:${marketKey}`;
}

export function snapshotBucketTs(capturedAt: number, bucketMs = DEFAULT_BUCKET_MS): number {
  if (!Number.isFinite(capturedAt)) return Date.now();
  const safeBucket = Number.isFinite(bucketMs) && bucketMs > 0 ? Math.floor(bucketMs) : DEFAULT_BUCKET_MS;
  return Math.floor(capturedAt / safeBucket) * safeBucket;
}

export async function writeMarketSnapshot(snapshot: PersistedMarketSnapshot): Promise<SnapshotRef> {
  const ttls = getPersistenceTtls();
  const bucketTs = snapshotBucketTs(snapshot.capturedAt);
  const snapshotKey = buildSnapshotKey(snapshot.sportKey, snapshot.eventId, snapshot.marketKey, bucketTs);
  const timelineKey = buildTimelineKey(snapshot.sportKey, snapshot.eventId, snapshot.marketKey);

  const payload: PersistedMarketSnapshot = {
    ...snapshot,
    version: SNAPSHOT_VERSION,
    capturedAt: bucketTs
  };
  recordPayloadSample("snapshot", JSON.stringify(payload).length);

  await persistenceSetJson(snapshotKey, payload, ttls.rawSnapshotSeconds);

  await persistenceMutateJson<StoredMarketTimeline>(timelineKey, ttls.timelineSeconds, (existing) => {
    const nextPoint = timelinePoint(payload, snapshotKey);
    const prior = existing?.points || [];
    const withoutSameTs = prior.filter((point) => point.ts !== nextPoint.ts);
    const retentionFloor = Date.now() - ttls.timelineSeconds * 1000;

    const points = [...withoutSameTs, nextPoint]
      .filter((point) => point.ts >= retentionFloor)
      .sort((a, b) => a.ts - b.ts)
      .slice(-MAX_TIMELINE_POINTS);

    return {
      version: TIMELINE_VERSION,
      sportKey: snapshot.sportKey,
      eventId: snapshot.eventId,
      marketKey: snapshot.marketKey,
      points
    };
  });

  return {
    key: snapshotKey,
    bucketTs
  };
}

export async function readMarketSnapshot(
  sportKey: string,
  eventId: string,
  marketKey: string,
  bucketTs: number
): Promise<PersistedMarketSnapshot | null> {
  return persistenceGetJson<PersistedMarketSnapshot>(buildSnapshotKey(sportKey, eventId, marketKey, bucketTs));
}

export async function readMarketTimeline(
  sportKey: string,
  eventId: string,
  marketKey: string
): Promise<StoredMarketTimeline | null> {
  const startedAt = Date.now();
  const value = await persistenceGetJson<StoredMarketTimeline>(buildTimelineKey(sportKey, eventId, marketKey));
  recordTimelineReadLatency(Date.now() - startedAt);
  return value;
}
