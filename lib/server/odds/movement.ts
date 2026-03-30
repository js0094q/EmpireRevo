import { calculateEvPercent } from "@/lib/server/odds/ev";
import { getOddsHistoryConfig } from "@/lib/server/odds/historyConfig";
import type { StoredMarketTimeline, StoredTimelinePoint } from "@/lib/server/odds/historyStore";
import type {
  FairOutcomeBook,
  LineMovementDirection,
  LineMovementSummary,
  MarketPressureSignal,
  ValueTimingSignal
} from "@/lib/server/odds/types";

type TimelineBookPoint = {
  ts: number;
  priceAmerican: number | null;
  point: number | null;
};

const PRICE_MOVE_THRESHOLD = 4;
const POINT_MOVE_THRESHOLD = 0.5;

function finiteNumber(value: number | null | undefined): number | null {
  return Number.isFinite(value) ? Number(value) : null;
}

function toIso(ts: number | null | undefined): string | null {
  if (!Number.isFinite(ts)) return null;
  return new Date(Number(ts)).toISOString();
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}

function directionFromDiffs(diffs: number[]): LineMovementDirection {
  const nonZero = diffs.filter((diff) => Math.abs(diff) > 0.001);
  if (!nonZero.length) return "flat";
  const hasPositive = nonZero.some((diff) => diff > 0);
  const hasNegative = nonZero.some((diff) => diff < 0);
  if (hasPositive && hasNegative) return "mixed";
  return hasPositive ? "up" : "down";
}

function velocityForWindow(points: TimelineBookPoint[], windowMs: number): number | null {
  if (points.length < 2) return null;
  const current = points[points.length - 1];
  if (!current || !Number.isFinite(current.ts)) return null;
  const floor = current.ts - windowMs;
  const withinWindow = points.filter((point) => point.ts >= floor && Number.isFinite(point.priceAmerican));
  if (withinWindow.length < 2) return null;
  const start = withinWindow[0];
  if (!start || !Number.isFinite(start.ts) || !Number.isFinite(start.priceAmerican) || !Number.isFinite(current.priceAmerican)) {
    return null;
  }
  const elapsedMinutes = (current.ts - start.ts) / (60 * 1000);
  if (elapsedMinutes <= 0) return null;
  return (Number(current.priceAmerican) - Number(start.priceAmerican)) / elapsedMinutes;
}

function normalizeBookSeries(points: TimelineBookPoint[]): TimelineBookPoint[] {
  return points
    .filter((point) => Number.isFinite(point.ts))
    .sort((a, b) => a.ts - b.ts)
    .reduce<TimelineBookPoint[]>((acc, point) => {
      const last = acc[acc.length - 1];
      if (
        last &&
        last.priceAmerican === point.priceAmerican &&
        last.point === point.point
      ) {
        return acc;
      }
      acc.push(point);
      return acc;
    }, []);
}

export function buildLineMovementSummary(params: {
  points: TimelineBookPoint[];
  nowMs?: number;
  shortWindowMs?: number;
  longWindowMs?: number;
}): LineMovementSummary | null {
  const config = getOddsHistoryConfig();
  const nowMs = params.nowMs ?? Date.now();
  const shortWindowMs = params.shortWindowMs ?? config.shortWindowMinutes * 60 * 1000;
  const longWindowMs = params.longWindowMs ?? config.longWindowMinutes * 60 * 1000;
  const points = normalizeBookSeries(params.points);
  if (!points.length) return null;

  const opening = points[0];
  const current = points[points.length - 1];
  const previous = points.length > 1 ? points[points.length - 2] : current;
  const priceDiffs: number[] = [];
  for (let idx = 1; idx < points.length; idx += 1) {
    const prev = points[idx - 1];
    const next = points[idx];
    if (!prev || !next) continue;
    if (Number.isFinite(prev.priceAmerican) && Number.isFinite(next.priceAmerican)) {
      priceDiffs.push(Number(next.priceAmerican) - Number(prev.priceAmerican));
    }
  }

  const openingPriceAmerican = finiteNumber(opening.priceAmerican);
  const currentPriceAmerican = finiteNumber(current.priceAmerican);
  const prevPriceAmerican = finiteNumber(previous.priceAmerican);
  const openingPoint = finiteNumber(opening.point);
  const currentPoint = finiteNumber(current.point);
  const priceDelta =
    openingPriceAmerican !== null && currentPriceAmerican !== null
      ? currentPriceAmerican - openingPriceAmerican
      : null;
  const pointDelta =
    openingPoint !== null && currentPoint !== null
      ? currentPoint - openingPoint
      : null;
  const delta =
    prevPriceAmerican !== null && currentPriceAmerican !== null
      ? currentPriceAmerican - prevPriceAmerican
      : 0;
  const move = priceDelta ?? 0;
  const lastObservedAt = toIso(current.ts);

  return {
    openPrice: openingPriceAmerican ?? currentPriceAmerican ?? 0,
    prevPrice: prevPriceAmerican ?? currentPriceAmerican ?? 0,
    currentPrice: currentPriceAmerican ?? 0,
    delta,
    move,
    updatedAt: lastObservedAt || new Date(nowMs).toISOString(),
    history: points.map((point) => ({
      ts: new Date(point.ts).toISOString(),
      priceAmerican: finiteNumber(point.priceAmerican),
      point: finiteNumber(point.point)
    })),
    openingPriceAmerican,
    currentPriceAmerican,
    openingPoint,
    currentPoint,
    priceDelta,
    pointDelta,
    direction: directionFromDiffs(priceDiffs),
    observations: points.length,
    firstObservedAt: toIso(opening.ts),
    lastObservedAt,
    velocityShortWindow: velocityForWindow(points, shortWindowMs),
    velocityLongWindow: velocityForWindow(points, longWindowMs),
    lineAgeSeconds: Number.isFinite(current.ts) ? Math.max(0, Math.round((nowMs - current.ts) / 1000)) : null,
    stale: Number.isFinite(current.ts) ? nowMs - current.ts > longWindowMs : true
  };
}

function groupBookPoints(timeline: StoredMarketTimeline): Map<string, TimelineBookPoint[]> {
  const grouped = new Map<string, TimelineBookPoint[]>();
  for (const point of timeline.points) {
    for (const book of point.books) {
      const rows = grouped.get(book.bookKey) || [];
      rows.push({
        ts: point.ts,
        priceAmerican: finiteNumber(book.american),
        point: finiteNumber(book.point)
      });
      grouped.set(book.bookKey, rows);
    }
  }
  return grouped;
}

export function buildBookMovementMap(params: {
  timeline: StoredMarketTimeline | null;
  books: Pick<FairOutcomeBook, "bookKey">[];
  nowMs?: number;
}): Map<string, LineMovementSummary> {
  const grouped = params.timeline ? groupBookPoints(params.timeline) : new Map<string, TimelineBookPoint[]>();
  const map = new Map<string, LineMovementSummary>();
  for (const book of params.books) {
    const summary = buildLineMovementSummary({
      points: grouped.get(book.bookKey) || [],
      nowMs: params.nowMs
    });
    if (summary) {
      map.set(book.bookKey, summary);
    }
  }
  return map;
}

type FirstMove = {
  firstSeen: number;
  firstMoveTs: number | null;
  openPrice: number | null;
  openPoint: number | null;
  isSharp: boolean;
};

function buildFirstMoveMap(points: StoredTimelinePoint[]): Map<string, FirstMove> {
  const map = new Map<string, FirstMove>();
  for (const point of points) {
    for (const book of point.books) {
      const currentPrice = finiteNumber(book.american);
      const currentPoint = finiteNumber(book.point);
      const existing = map.get(book.bookKey);
      if (!existing) {
        map.set(book.bookKey, {
          firstSeen: point.ts,
          firstMoveTs: null,
          openPrice: currentPrice,
          openPoint: currentPoint,
          isSharp: Boolean(book.isSharp)
        });
        continue;
      }
      const priceMoved =
        existing.openPrice !== null &&
        currentPrice !== null &&
        Math.abs(currentPrice - existing.openPrice) >= PRICE_MOVE_THRESHOLD;
      const pointMoved =
        existing.openPoint !== null &&
        currentPoint !== null &&
        Math.abs(currentPoint - existing.openPoint) >= POINT_MOVE_THRESHOLD;
      if (existing.firstMoveTs === null && (priceMoved || pointMoved)) {
        existing.firstMoveTs = point.ts;
      }
    }
  }
  return map;
}

function shiftDirection(points: StoredTimelinePoint[]): "up" | "down" | "flat" {
  if (points.length < 2) return "flat";
  const firstFair = finiteNumber(points[0]?.fairAmerican ?? points[0]?.globalBestAmerican);
  const lastFair = finiteNumber(points[points.length - 1]?.fairAmerican ?? points[points.length - 1]?.globalBestAmerican);
  if (firstFair === null || lastFair === null) return "flat";
  if (lastFair > firstFair) return "up";
  if (lastFair < firstFair) return "down";
  return "flat";
}

export function deriveMarketPressureSignal(params: {
  timeline: StoredMarketTimeline | null;
  nowMs?: number;
}): MarketPressureSignal {
  const config = getOddsHistoryConfig();
  const nowMs = params.nowMs ?? Date.now();
  const points = [...(params.timeline?.points || [])].sort((a, b) => a.ts - b.ts);
  const lastPoint = points[points.length - 1];
  const lastAge = lastPoint ? nowMs - lastPoint.ts : Number.POSITIVE_INFINITY;

  if (!points.length) {
    return {
      label: "none",
      confidence: "low",
      severity: "low",
      explanation: "No persisted snapshots are available for this market yet.",
      evidence: {
        observations: 0
      }
    };
  }

  if (lastAge > config.longWindowMinutes * 60 * 1000) {
    return {
      label: "stale",
      confidence: "medium",
      severity: "medium",
      explanation: "Stored market history is stale relative to the configured long window.",
      evidence: {
        staleDurationMs: lastAge,
        observations: points.length
      }
    };
  }

  const firstMoves = Array.from(buildFirstMoveMap(points).values());
  const sharpMoves = firstMoves
    .filter((entry) => entry.isSharp && Number.isFinite(entry.firstMoveTs))
    .map((entry) => Number(entry.firstMoveTs));
  const publicMoves = firstMoves
    .filter((entry) => !entry.isSharp && Number.isFinite(entry.firstMoveTs))
    .map((entry) => Number(entry.firstMoveTs));
  const earliestSharp = sharpMoves.length ? Math.min(...sharpMoves) : null;
  const earliestPublic = publicMoves.length ? Math.min(...publicMoves) : null;
  const direction = shiftDirection(points);

  if (
    earliestSharp !== null &&
    earliestPublic !== null &&
    earliestPublic - earliestSharp >= 5 * 60 * 1000 &&
    direction !== "flat"
  ) {
    const confidence = earliestPublic - earliestSharp >= 12 * 60 * 1000 ? "high" : "medium";
    return {
      label: direction === "up" ? "sharp-up" : "sharp-down",
      confidence,
      severity: confidence,
      explanation: "Sharp books moved before the broader market and the rest of the board later followed.",
      evidence: {
        sharpBooksMovedFirst: true,
        staleDurationMs: earliestPublic - earliestSharp,
        observations: points.length
      }
    };
  }

  const bookDirections = Array.from(
    groupBookPoints(
      params.timeline || { version: 2, sportKey: "", eventId: "", marketKey: "", points: [] }
    ).values()
  )
    .map((series) => buildLineMovementSummary({ points: series, nowMs }))
    .filter((entry): entry is LineMovementSummary => Boolean(entry))
    .map((entry) => entry.direction);
  const uniqueDirections = new Set(bookDirections.filter((entry) => entry !== "flat"));

  if (uniqueDirections.size > 1 || bookDirections.includes("mixed")) {
    return {
      label: "fragmented",
      confidence: points.length >= 4 ? "medium" : "low",
      severity: points.length >= 4 ? "medium" : "low",
      explanation: "Books have moved in conflicting directions across the stored snapshot window.",
      evidence: {
        observations: points.length
      }
    };
  }

  if (direction !== "flat" && points.length >= 3) {
    return {
      label: "broad-consensus",
      confidence: points.length >= 6 ? "high" : "medium",
      severity: points.length >= 6 ? "high" : "medium",
      explanation: "Books have moved together in a broadly consistent direction.",
      evidence: {
        observations: points.length
      }
    };
  }

  return {
    label: "none",
    confidence: points.length >= 3 ? "medium" : "low",
    severity: points.length >= 3 ? "medium" : "low",
    explanation: "Observed history does not yet show a reliable lead-lag pattern.",
    evidence: {
      observations: points.length
    }
  };
}

function edgeSamples(points: StoredTimelinePoint[]): Array<{ ts: number; evPct: number }> {
  const samples: Array<{ ts: number; evPct: number }> = [];
  for (const point of points) {
    if (!Number.isFinite(point.fairProb) || !Number.isFinite(point.globalBestAmerican)) continue;
    const evPct = calculateEvPercent(Number(point.fairProb), Number(point.globalBestAmerican));
    if (!Number.isFinite(evPct)) continue;
    samples.push({ ts: point.ts, evPct });
  }
  return samples.sort((a, b) => a.ts - b.ts);
}

export function deriveValueTimingSignal(params: {
  timeline: StoredMarketTimeline | null;
  nowMs?: number;
}): ValueTimingSignal {
  const config = getOddsHistoryConfig();
  const nowMs = params.nowMs ?? Date.now();
  const points = [...(params.timeline?.points || [])].sort((a, b) => a.ts - b.ts);
  const samples = edgeSamples(points);
  if (samples.length < 2) {
    return {
      firstPositiveEvAt: null,
      lastPositiveEvAt: null,
      positiveEvDurationSeconds: null,
      valuePersistence: "unknown",
      edgeTrend: "unknown"
    };
  }

  const threshold = config.valuePersistenceThresholdPct;
  const firstPositive = samples.find((sample) => sample.evPct >= threshold) || null;
  const lastPositive = [...samples].reverse().find((sample) => sample.evPct >= threshold) || null;
  const intervals = samples.slice(1).map((sample, idx) => sample.ts - samples[idx]!.ts).filter((diff) => diff > 0);
  const medianInterval = median(intervals) ?? 0;
  let positiveDurationMs = 0;

  for (let idx = 0; idx < samples.length; idx += 1) {
    const sample = samples[idx];
    if (!sample || sample.evPct < threshold) continue;
    const nextTs = samples[idx + 1]?.ts ?? (medianInterval > 0 ? sample.ts + medianInterval : sample.ts);
    if (nextTs > sample.ts) {
      positiveDurationMs += nextTs - sample.ts;
    }
  }

  const shortWindowMs = config.shortWindowMinutes * 60 * 1000;
  const longWindowMs = config.longWindowMinutes * 60 * 1000;
  const recentSamples = samples.filter((sample) => sample.ts >= nowMs - shortWindowMs);
  const priorSamples = samples.filter(
    (sample) => sample.ts < nowMs - shortWindowMs && sample.ts >= nowMs - longWindowMs
  );
  const recentAvg = average(recentSamples.map((sample) => sample.evPct));
  const priorAvg = average(priorSamples.map((sample) => sample.evPct));
  let edgeTrend: ValueTimingSignal["edgeTrend"] = "unknown";
  if (recentAvg !== null && priorAvg !== null) {
    const diff = recentAvg - priorAvg;
    if (diff >= 0.35) edgeTrend = "improving";
    else if (diff <= -0.35) edgeTrend = "worsening";
    else edgeTrend = "flat";
  }

  let valuePersistence: ValueTimingSignal["valuePersistence"] = "unknown";
  if (lastPositive && nowMs - lastPositive.ts > longWindowMs) {
    valuePersistence = "stale";
  } else if (positiveDurationMs >= shortWindowMs) {
    valuePersistence = "stable";
  } else if (positiveDurationMs >= Math.max(60_000, shortWindowMs / 2)) {
    valuePersistence = "developing";
  } else if (positiveDurationMs > 0) {
    valuePersistence = "fleeting";
  }

  return {
    firstPositiveEvAt: firstPositive ? new Date(firstPositive.ts).toISOString() : null,
    lastPositiveEvAt: lastPositive ? new Date(lastPositive.ts).toISOString() : null,
    positiveEvDurationSeconds: positiveDurationMs > 0 ? Math.round(positiveDurationMs / 1000) : null,
    valuePersistence,
    edgeTrend
  };
}

type LegacyFoldParams = {
  previous?: Pick<LineMovementSummary, "openPrice" | "prevPrice" | "currentPrice" | "updatedAt" | "history">;
  currentPrice: number;
  nowIso: string;
  windowMs: number;
  retentionMs: number;
  maxPoints: number;
};

export function foldHistory(params: LegacyFoldParams): LineMovementSummary {
  const nowMs = Date.parse(params.nowIso);
  const minKeep = nowMs - params.retentionMs;
  const minWindow = nowMs - params.windowMs;
  const previousHistory = (params.previous?.history || []).filter((point) => {
    const ts = Date.parse(point.ts);
    return Number.isFinite(ts) && ts >= minKeep;
  });
  const lastPoint = previousHistory[previousHistory.length - 1];
  if (!lastPoint || lastPoint.priceAmerican !== params.currentPrice) {
    previousHistory.push({ ts: params.nowIso, priceAmerican: params.currentPrice, point: null });
  }
  const trimmed = previousHistory.slice(-params.maxPoints);
  const windowed = trimmed.filter((point) => {
    const ts = Date.parse(point.ts);
    return Number.isFinite(ts) && ts >= minWindow;
  });
  return (
    buildLineMovementSummary({
      points: windowed.map((point) => ({
        ts: Date.parse(point.ts),
        priceAmerican: point.priceAmerican,
        point: point.point ?? null
      })),
      nowMs
    }) || {
      openPrice: params.previous?.openPrice ?? params.currentPrice,
      prevPrice: params.previous?.currentPrice ?? params.currentPrice,
      currentPrice: params.currentPrice,
      delta: 0,
      move: 0,
      updatedAt: params.nowIso,
      history: windowed
    }
  );
}
