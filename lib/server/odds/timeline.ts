import type { BookTimelinePoint, MarketTimelineResponse, TimelinePoint } from "@/lib/server/odds/types";
import { readMarketTimeline, type StoredTimelinePoint } from "@/lib/server/odds/historyStore";

export type TimelineAnchors = {
  open: StoredTimelinePoint | null;
  previous: StoredTimelinePoint | null;
  current: StoredTimelinePoint | null;
};

export function resolveTimelineAnchors(points: StoredTimelinePoint[]): TimelineAnchors {
  if (!points.length) {
    return {
      open: null,
      previous: null,
      current: null
    };
  }

  const sorted = [...points].sort((a, b) => a.ts - b.ts);
  const current = sorted[sorted.length - 1] || null;
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] || null : null;
  const open = sorted.length > 1 ? sorted[0] || null : null;

  return {
    open,
    previous,
    current
  };
}

function toTimelinePoints(points: StoredTimelinePoint[]): TimelinePoint[] {
  return points.map((point) => ({
    ts: point.ts,
    fairAmerican: point.fairAmerican ?? null,
    fairProb: point.fairProb ?? null,
    globalBestAmerican: point.globalBestAmerican ?? null,
    pinnedBestAmerican: point.pinnedBestAmerican ?? null,
    globalBestPoint: point.globalBestPoint ?? null,
    pinnedBestPoint: point.pinnedBestPoint ?? null,
    observationCount: point.observationCount
  }));
}

function toBookPoints(points: StoredTimelinePoint[], bookFilter?: Set<string>): BookTimelinePoint[] {
  const rows: BookTimelinePoint[] = [];
  for (const point of points) {
    for (const book of point.books) {
      if (bookFilter && !bookFilter.has(book.bookKey)) continue;
      rows.push({
        ts: point.ts,
        bookKey: book.bookKey,
        american: book.american ?? null,
        point: book.point ?? null
      });
    }
  }
  return rows;
}

export async function buildMarketTimeline(params: {
  sportKey: string;
  eventId: string;
  marketKey: string;
  rollingPoints?: number;
  bookKeys?: string[];
}): Promise<MarketTimelineResponse> {
  const record = await readMarketTimeline(params.sportKey, params.eventId, params.marketKey);
  const sorted = [...(record?.points || [])].sort((a, b) => a.ts - b.ts);
  const safeRolling = Number.isFinite(params.rollingPoints) ? Math.max(1, Math.floor(params.rollingPoints as number)) : 0;
  const points = safeRolling > 0 ? sorted.slice(-safeRolling) : sorted;

  const anchors = resolveTimelineAnchors(sorted);
  const bookFilter = params.bookKeys && params.bookKeys.length ? new Set(params.bookKeys) : undefined;

  return {
    eventId: params.eventId,
    marketKey: params.marketKey,
    points: toTimelinePoints(points),
    books: toBookPoints(points, bookFilter),
    openTs: anchors.open?.ts ?? null,
    currentTs: anchors.current?.ts ?? Date.now()
  };
}
