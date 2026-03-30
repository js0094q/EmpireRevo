import { readMarketTimeline, type StoredTimelinePoint } from "@/lib/server/odds/historyStore";
import type { CloseReferenceMethod } from "@/lib/server/odds/types";

export type ClosingLineMethod = CloseReferenceMethod;
export const DEFAULT_CLOSE_REFERENCE: CloseReferenceMethod = "closing_global_best";

export type ClosingLineSelection = {
  method: ClosingLineMethod;
  ts: number | null;
  american: number | null;
  point: number | null;
};

export function describeCloseReference(method: CloseReferenceMethod): string {
  if (method === "closing_global_best") return "Best available market price at close.";
  if (method === "closing_pinned_best") return "Best available pinned-book price at close.";
  if (method === "closing_sharp_consensus") return "Median sharp-book closing price.";
  return "Model fair line at close.";
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid] ?? null;
  }
  const a = sorted[mid - 1];
  const b = sorted[mid];
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return (a + b) / 2;
}

function valueAt(point: StoredTimelinePoint, method: ClosingLineMethod): { american: number | null; point: number | null } {
  if (method === "closing_global_best") {
    return {
      american: Number.isFinite(point.globalBestAmerican) ? Number(point.globalBestAmerican) : null,
      point: Number.isFinite(point.globalBestPoint) ? Number(point.globalBestPoint) : null
    };
  }
  if (method === "closing_pinned_best") {
    return {
      american: Number.isFinite(point.pinnedBestAmerican) ? Number(point.pinnedBestAmerican) : null,
      point: Number.isFinite(point.pinnedBestPoint) ? Number(point.pinnedBestPoint) : null
    };
  }
  if (method === "closing_fair") {
    return {
      american: Number.isFinite(point.fairAmerican) ? Number(point.fairAmerican) : null,
      point: null
    };
  }

  const sharp = point.books
    .filter((book) => book.isSharp)
    .map((book) => ({ american: book.american, point: book.point }))
    .filter((book) => Number.isFinite(book.american));
  return {
    american: median(sharp.map((book) => Number(book.american))),
    point: median(sharp.map((book) => Number(book.point)).filter((value) => Number.isFinite(value)))
  };
}

function pickClosingPoint(points: StoredTimelinePoint[], closeTs?: number): StoredTimelinePoint[] {
  const sorted = [...points].sort((a, b) => a.ts - b.ts);
  if (!Number.isFinite(closeTs)) return sorted;
  return sorted.filter((point) => point.ts <= (closeTs as number));
}

export function selectClosingLine(params: {
  points: StoredTimelinePoint[];
  method: ClosingLineMethod;
  closeTs?: number;
}): ClosingLineSelection {
  const candidates = pickClosingPoint(params.points, params.closeTs);

  for (let idx = candidates.length - 1; idx >= 0; idx -= 1) {
    const point = candidates[idx];
    if (!point) continue;
    const value = valueAt(point, params.method);
    if (Number.isFinite(value.american)) {
      return {
        method: params.method,
        ts: point.ts,
        american: value.american,
        point: value.point
      };
    }
  }

  return {
    method: params.method,
    ts: null,
    american: null,
    point: null
  };
}

export async function resolveClosingLines(params: {
  sportKey: string;
  eventId: string;
  marketKey: string;
  closeTs?: number;
}): Promise<Record<ClosingLineMethod, ClosingLineSelection>> {
  const timeline = await readMarketTimeline(params.sportKey, params.eventId, params.marketKey);
  const points = timeline?.points || [];

  return {
    closing_global_best: selectClosingLine({ points, method: "closing_global_best", closeTs: params.closeTs }),
    closing_pinned_best: selectClosingLine({ points, method: "closing_pinned_best", closeTs: params.closeTs }),
    closing_sharp_consensus: selectClosingLine({ points, method: "closing_sharp_consensus", closeTs: params.closeTs }),
    closing_fair: selectClosingLine({ points, method: "closing_fair", closeTs: params.closeTs })
  };
}
