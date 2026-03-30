import type {
  PersistedMarketSnapshot,
  PersistedOddsSnapshot,
  PersistedSnapshotBucket
} from "@/lib/server/odds/types";
import { getPersistenceTtls } from "@/lib/server/odds/persistenceConfig";
import {
  persistenceGetJson,
  persistenceGetManyJson,
  persistenceMutateJson,
  persistenceSetJson
} from "@/lib/server/odds/persistence";
import { recordPayloadSample, recordTimelineReadLatency } from "@/lib/server/odds/persistenceTelemetry";

export type StoredTimelineBook = {
  bookKey: string;
  bookTitle?: string;
  american?: number | null;
  point?: number | null;
  isSharp?: boolean;
  isPinned?: boolean;
};

export type StoredTimelinePoint = {
  ts: number;
  snapshotKey: string;
  fairAmerican?: number | null;
  fairProb?: number | null;
  globalBestAmerican?: number | null;
  pinnedBestAmerican?: number | null;
  globalBestPoint?: number | null;
  pinnedBestPoint?: number | null;
  books: StoredTimelineBook[];
  observationCount?: number;
};

export type StoredMarketTimeline = {
  version: 2;
  sportKey: string;
  eventId: string;
  marketKey: string;
  points: StoredTimelinePoint[];
};

export type StoredEventHistoryMarket = {
  marketKey: string;
  snapshotCount: number;
  firstTs: number | null;
  lastTs: number | null;
};

export type StoredEventHistoryIndex = {
  version: 1;
  sportKey: string;
  eventId: string;
  snapshotCount: number;
  oldestObservedAt: number | null;
  newestObservedAt: number | null;
  markets: StoredEventHistoryMarket[];
};

export type EventHistorySummary = {
  sportKey: string;
  eventId: string;
  snapshotCount: number;
  oldestObservedAt: number | null;
  newestObservedAt: number | null;
  markets: StoredEventHistoryMarket[];
};

export type SnapshotRef = {
  key: string;
  bucketTs: number;
};

const TIMELINE_VERSION = 2 as const;
const SNAPSHOT_BUCKET_VERSION = 1 as const;
const EVENT_INDEX_VERSION = 1 as const;
const DEFAULT_BUCKET_MS = 60 * 1000;
const MAX_TIMELINE_POINTS = 5000;
const RECENT_EVENT_INDEX_KEY = "empire:odds:history:index:events";
const MAX_RECENT_EVENTS = 300;

function bestSnapshot(
  snapshots: PersistedOddsSnapshot[],
  predicate?: (snapshot: PersistedOddsSnapshot) => boolean
): PersistedOddsSnapshot | null {
  const eligible = snapshots
    .filter((snapshot) => (predicate ? predicate(snapshot) : true))
    .filter((snapshot) => Number.isFinite(snapshot.priceAmerican));
  if (!eligible.length) return null;
  return eligible.reduce((best, snapshot) =>
    Number(snapshot.priceAmerican) > Number(best.priceAmerican) ? snapshot : best
  );
}

function asTimelineBooks(bucket: PersistedSnapshotBucket): StoredTimelineBook[] {
  return bucket.snapshots.map((snapshot) => ({
    bookKey: snapshot.bookmakerKey,
    bookTitle: snapshot.bookmakerTitle,
    american: snapshot.priceAmerican ?? null,
    point: snapshot.point ?? null,
    isSharp: Boolean(snapshot.isSharp),
    isPinned: Boolean(snapshot.isPinned)
  }));
}

function toTimelinePoint(bucket: PersistedSnapshotBucket, snapshotKey: string): StoredTimelinePoint {
  const globalBest = bestSnapshot(bucket.snapshots);
  const pinnedBest = bestSnapshot(bucket.snapshots, (snapshot) => Boolean(snapshot.isPinned));

  return {
    ts: bucket.capturedAt,
    snapshotKey,
    fairAmerican: bucket.fair?.fairAmerican ?? null,
    fairProb: bucket.fair?.fairProb ?? null,
    globalBestAmerican: globalBest?.priceAmerican ?? null,
    pinnedBestAmerican: pinnedBest?.priceAmerican ?? null,
    globalBestPoint: globalBest?.point ?? null,
    pinnedBestPoint: pinnedBest?.point ?? null,
    books: asTimelineBooks(bucket),
    observationCount: bucket.snapshots.length
  };
}

function eventIdentity(sportKey: string, eventId: string): string {
  return `${sportKey}:${eventId}`;
}

function dedupeSnapshots(snapshots: PersistedOddsSnapshot[], observedAt: string): PersistedOddsSnapshot[] {
  const byIdentity = new Map<string, PersistedOddsSnapshot>();
  for (const snapshot of snapshots) {
    const identity = `${snapshot.bookmakerKey}|${snapshot.outcomeKey}`;
    byIdentity.set(identity, {
      ...snapshot,
      version: SNAPSHOT_BUCKET_VERSION,
      observedAt
    });
  }
  return Array.from(byIdentity.values()).sort((a, b) => a.bookmakerKey.localeCompare(b.bookmakerKey));
}

function normalizeBucket(
  snapshot: PersistedSnapshotBucket | PersistedMarketSnapshot
): PersistedSnapshotBucket {
  if ("snapshots" in snapshot) {
    return snapshot;
  }

  const observedAt = new Date(snapshot.capturedAt).toISOString();
  return {
    version: SNAPSHOT_BUCKET_VERSION,
    capturedAt: snapshot.capturedAt,
    observedAt,
    sportKey: snapshot.sportKey,
    eventId: snapshot.eventId,
    marketKey: snapshot.marketKey,
    marketType: snapshot.marketType,
    fair: snapshot.fair,
    diagnostics: snapshot.diagnostics,
    snapshots: snapshot.books.flatMap((book) =>
      book.outcomes.map((outcome) => ({
        version: SNAPSHOT_BUCKET_VERSION,
        sportKey: snapshot.sportKey,
        eventId: snapshot.eventId,
        marketKey: snapshot.marketKey,
        marketType: snapshot.marketType,
        outcomeKey: String(outcome.name || "unknown").toLowerCase(),
        outcomeLabel: outcome.name,
        bookmakerKey: book.bookKey,
        bookmakerTitle: book.bookTitle,
        bookmakerTier: book.bookTier,
        isPinned: book.isPinned,
        isSharp: book.isSharp,
        isBestPrice: book.isBestPrice,
        priceAmerican: outcome.priceAmerican ?? null,
        point: outcome.point ?? null,
        impliedProbability: outcome.impliedProb ?? null,
        noVigProbability: outcome.noVigProb ?? null,
        fairProbability: snapshot.fair?.fairProb ?? null,
        fairAmerican: snapshot.fair?.fairAmerican ?? null,
        rankingScore: snapshot.diagnostics?.rankingScore ?? null,
        confidenceScore: snapshot.diagnostics?.confidenceScore ?? null,
        staleStrength: snapshot.diagnostics?.stalePenalty ?? null,
        timingUrgency: Number.isFinite(snapshot.diagnostics?.timingPenalty)
          ? 1 - Number(snapshot.diagnostics?.timingPenalty)
          : null,
        observedAt,
        bookLastSeenAt: new Date(book.lastSeenAt).toISOString()
      }))
    )
  };
}

export function buildSnapshotKey(sportKey: string, eventId: string, marketKey: string, bucketTs: number): string {
  return `empire:odds:snapshot:${sportKey}:${eventId}:${marketKey}:${bucketTs}`;
}

export function buildTimelineKey(sportKey: string, eventId: string, marketKey: string): string {
  return `empire:odds:timeline:${sportKey}:${eventId}:${marketKey}`;
}

export function buildEventHistoryIndexKey(sportKey: string, eventId: string): string {
  return `empire:odds:history:index:${sportKey}:${eventId}`;
}

export function snapshotBucketTs(capturedAt: number, bucketMs = DEFAULT_BUCKET_MS): number {
  if (!Number.isFinite(capturedAt)) return Date.now();
  const safeBucket = Number.isFinite(bucketMs) && bucketMs > 0 ? Math.floor(bucketMs) : DEFAULT_BUCKET_MS;
  return Math.floor(capturedAt / safeBucket) * safeBucket;
}

async function appendRecentEvent(eventKey: string, ttlSeconds: number): Promise<void> {
  await persistenceMutateJson<string[]>(RECENT_EVENT_INDEX_KEY, ttlSeconds, (existing) => {
    const prior = existing || [];
    const deduped = prior.filter((value) => value !== eventKey);
    return [...deduped, eventKey].slice(-MAX_RECENT_EVENTS);
  });
}

export async function writeMarketSnapshot(
  bucketInput: PersistedSnapshotBucket | PersistedMarketSnapshot
): Promise<SnapshotRef> {
  const ttls = getPersistenceTtls();
  const bucket = normalizeBucket(bucketInput);
  const bucketTs = snapshotBucketTs(bucket.capturedAt);
  const observedAt = new Date(bucketTs).toISOString();
  const snapshotKey = buildSnapshotKey(bucket.sportKey, bucket.eventId, bucket.marketKey, bucketTs);
  const timelineKey = buildTimelineKey(bucket.sportKey, bucket.eventId, bucket.marketKey);
  const eventIndexKey = buildEventHistoryIndexKey(bucket.sportKey, bucket.eventId);

  const payload: PersistedSnapshotBucket = {
    ...bucket,
    version: SNAPSHOT_BUCKET_VERSION,
    capturedAt: bucketTs,
    observedAt,
    snapshots: dedupeSnapshots(bucket.snapshots, observedAt)
  };
  recordPayloadSample("snapshot", JSON.stringify(payload).length);

  await persistenceSetJson(snapshotKey, payload, ttls.rawSnapshotSeconds);

  await persistenceMutateJson<StoredMarketTimeline>(timelineKey, ttls.timelineSeconds, (existing) => {
    const nextPoint = toTimelinePoint(payload, snapshotKey);
    const prior = existing?.points || [];
    const withoutSameTs = prior.filter((point) => point.ts !== nextPoint.ts);
    const retentionFloor = Date.now() - ttls.timelineSeconds * 1000;

    const points = [...withoutSameTs, nextPoint]
      .filter((point) => point.ts >= retentionFloor)
      .sort((a, b) => a.ts - b.ts)
      .slice(-MAX_TIMELINE_POINTS);

    return {
      version: TIMELINE_VERSION,
      sportKey: bucket.sportKey,
      eventId: bucket.eventId,
      marketKey: bucket.marketKey,
      points
    };
  });

  await persistenceMutateJson<StoredEventHistoryIndex>(eventIndexKey, ttls.timelineSeconds, (existing) => {
    const nextMarket: StoredEventHistoryMarket = {
      marketKey: bucket.marketKey,
      snapshotCount: 1,
      firstTs: bucketTs,
      lastTs: bucketTs
    };
    const priorMarkets = existing?.markets || [];
    const existingMarket = priorMarkets.find((market) => market.marketKey === bucket.marketKey);
    const markets = [
      ...priorMarkets.filter((market) => market.marketKey !== bucket.marketKey),
      existingMarket
        ? {
            marketKey: existingMarket.marketKey,
            snapshotCount: existingMarket.snapshotCount + 1,
            firstTs:
              existingMarket.firstTs === null
                ? bucketTs
                : Math.min(existingMarket.firstTs, bucketTs),
            lastTs:
              existingMarket.lastTs === null
                ? bucketTs
                : Math.max(existingMarket.lastTs, bucketTs)
          }
        : nextMarket
    ].sort((a, b) => a.marketKey.localeCompare(b.marketKey));

    const snapshotCount = markets.reduce((sum, market) => sum + market.snapshotCount, 0);
    const oldestObservedAt = markets.reduce<number | null>(
      (min, market) => (market.firstTs === null ? min : min === null ? market.firstTs : Math.min(min, market.firstTs)),
      null
    );
    const newestObservedAt = markets.reduce<number | null>(
      (max, market) => (market.lastTs === null ? max : max === null ? market.lastTs : Math.max(max, market.lastTs)),
      null
    );

    return {
      version: EVENT_INDEX_VERSION,
      sportKey: bucket.sportKey,
      eventId: bucket.eventId,
      snapshotCount,
      oldestObservedAt,
      newestObservedAt,
      markets
    };
  });

  await appendRecentEvent(eventIdentity(bucket.sportKey, bucket.eventId), ttls.timelineSeconds);

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
): Promise<PersistedSnapshotBucket | null> {
  return persistenceGetJson<PersistedSnapshotBucket>(buildSnapshotKey(sportKey, eventId, marketKey, bucketTs));
}

export async function readMarketSnapshotByKey(snapshotKey: string): Promise<PersistedSnapshotBucket | null> {
  return persistenceGetJson<PersistedSnapshotBucket>(snapshotKey);
}

export async function listMarketSnapshots(params: {
  sportKey: string;
  eventId: string;
  marketKey: string;
  sinceTs?: number;
}): Promise<PersistedSnapshotBucket[]> {
  const timeline = await readMarketTimeline(params.sportKey, params.eventId, params.marketKey);
  const points = [...(timeline?.points || [])]
    .filter((point) => !Number.isFinite(params.sinceTs) || point.ts >= Number(params.sinceTs))
    .sort((a, b) => a.ts - b.ts);
  const keys = Array.from(new Set(points.map((point) => point.snapshotKey)));
  if (!keys.length) return [];

  const records = await persistenceGetManyJson<PersistedSnapshotBucket>(keys);
  return keys
    .map((key) => records.get(key) || null)
    .filter((entry): entry is PersistedSnapshotBucket => Boolean(entry))
    .sort((a, b) => a.capturedAt - b.capturedAt);
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

export async function readEventHistorySummary(
  sportKey: string,
  eventId: string
): Promise<EventHistorySummary | null> {
  const value = await persistenceGetJson<StoredEventHistoryIndex>(buildEventHistoryIndexKey(sportKey, eventId));
  if (!value) return null;
  return {
    sportKey: value.sportKey,
    eventId: value.eventId,
    snapshotCount: value.snapshotCount,
    oldestObservedAt: value.oldestObservedAt,
    newestObservedAt: value.newestObservedAt,
    markets: value.markets
  };
}

export async function listRecentEventHistory(limit = 25): Promise<EventHistorySummary[]> {
  const recent = (await persistenceGetJson<string[]>(RECENT_EVENT_INDEX_KEY)) || [];
  const keys = recent.slice(-Math.max(1, Math.floor(limit))).reverse();
  const summaries = await Promise.all(
    keys.map(async (value) => {
      const [sportKey, ...eventParts] = value.split(":");
      const eventId = eventParts.join(":");
      if (!sportKey || !eventId) return null;
      return readEventHistorySummary(sportKey, eventId);
    })
  );
  return summaries.filter((entry): entry is EventHistorySummary => Boolean(entry));
}
