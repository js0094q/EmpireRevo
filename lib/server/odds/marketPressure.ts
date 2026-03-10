import { readMarketTimeline, type StoredTimelinePoint } from "@/lib/server/odds/historyStore";
import { listEvaluationResults, listValidationEvents } from "@/lib/server/odds/validationStore";
import { buildOutcomeMapForValidationEvents, computeOutcomeProfit } from "@/lib/server/odds/roiEvaluation";
import { buildOutcomeLookupKey } from "@/lib/server/odds/outcomes";
import type { CloseReferenceMethod, MarketPressureSignal, PersistedEvaluationResult, PersistedValidationEvent } from "@/lib/server/odds/types";

type FirstMove = {
  firstSeen: number;
  openPrice: number;
  firstMoveTs: number | null;
  isSharp: boolean;
  isPinned: boolean;
};

function finite(value: number | null | undefined): number | null {
  return Number.isFinite(value) ? Number(value) : null;
}

function severityByGap(gap: number): "low" | "medium" | "high" {
  if (gap >= 45 * 60 * 1000) return "high";
  if (gap >= 20 * 60 * 1000) return "medium";
  return "low";
}

function buildFirstMoveMap(points: StoredTimelinePoint[]): Map<string, FirstMove> {
  const byBook = new Map<string, FirstMove>();
  for (const point of points) {
    for (const book of point.books) {
      const price = finite(book.american);
      if (price === null) continue;
      const existing = byBook.get(book.bookKey);
      if (!existing) {
        byBook.set(book.bookKey, {
          firstSeen: point.ts,
          openPrice: price,
          firstMoveTs: null,
          isSharp: Boolean(book.isSharp),
          isPinned: Boolean(book.isPinned)
        });
        continue;
      }

      if (existing.firstMoveTs === null && price !== existing.openPrice) {
        existing.firstMoveTs = point.ts;
      }
      existing.isSharp = existing.isSharp || Boolean(book.isSharp);
      existing.isPinned = existing.isPinned || Boolean(book.isPinned);
    }
  }
  return byBook;
}

function firstMoveTs(entries: FirstMove[], predicate: (entry: FirstMove) => boolean): number | null {
  const moved = entries.filter((entry) => predicate(entry) && Number.isFinite(entry.firstMoveTs)) as Array<FirstMove & { firstMoveTs: number }>;
  if (!moved.length) return null;
  return moved.reduce((min, entry) => Math.min(min, entry.firstMoveTs), moved[0].firstMoveTs);
}

function staleRunSignal(points: StoredTimelinePoint[]): { laggingBooks: string[]; staleDurationMs: number | null } {
  let maxDuration = 0;
  const lagging = new Set<string>();

  const byBook = new Map<string, Array<{ ts: number; offBy: number }>>();
  for (const point of points) {
    const best = finite(point.globalBestAmerican);
    if (best === null) continue;
    for (const book of point.books) {
      const price = finite(book.american);
      if (price === null) continue;
      const offBy = Math.abs(best - price);
      const series = byBook.get(book.bookKey) || [];
      series.push({ ts: point.ts, offBy });
      byBook.set(book.bookKey, series);
    }
  }

  for (const [bookKey, series] of byBook.entries()) {
    let runStart: number | null = null;
    let localMax = 0;
    for (const row of series) {
      if (row.offBy >= 10) {
        if (runStart === null) runStart = row.ts;
        localMax = Math.max(localMax, row.ts - runStart);
      } else {
        runStart = null;
      }
    }

    if (localMax >= 20 * 60 * 1000) {
      lagging.add(bookKey);
      maxDuration = Math.max(maxDuration, localMax);
    }
  }

  return {
    laggingBooks: Array.from(lagging),
    staleDurationMs: maxDuration > 0 ? maxDuration : null
  };
}

export function detectMarketPressure(points: StoredTimelinePoint[]): MarketPressureSignal[] {
  if (points.length < 2) return [];

  const sorted = [...points].sort((a, b) => a.ts - b.ts);
  const map = buildFirstMoveMap(sorted);
  const entries = Array.from(map.values());
  const signals: MarketPressureSignal[] = [];

  const sharpFirst = firstMoveTs(entries, (entry) => entry.isSharp);
  const mainstreamFirst = firstMoveTs(entries, (entry) => !entry.isSharp);

  if (sharpFirst !== null && mainstreamFirst !== null && sharpFirst + 10 * 60 * 1000 <= mainstreamFirst) {
    const gap = mainstreamFirst - sharpFirst;
    signals.push({
      label: "sharp-led move",
      severity: severityByGap(gap),
      explanation: "Sharp books moved materially earlier than mainstream books in this observed timeline.",
      evidence: {
        sharpBooksMovedFirst: true,
        staleDurationMs: gap
      }
    });
  }

  if (sharpFirst !== null) {
    const laggingBooks = Array.from(map.entries())
      .filter(([, entry]) => !entry.isSharp && Number.isFinite(entry.firstMoveTs) && (entry.firstMoveTs as number) - sharpFirst >= 20 * 60 * 1000)
      .map(([bookKey]) => bookKey);

    if (laggingBooks.length) {
      signals.push({
        label: "mainstream lagging",
        severity: laggingBooks.length >= 3 ? "high" : "medium",
        explanation: "Mainstream books trailed the sharp-market move sequence in this market window.",
        evidence: {
          sharpBooksMovedFirst: true,
          laggingBooks
        }
      });
    }
  }

  const pinnedEntries = Array.from(map.entries()).filter(([, entry]) => entry.isPinned);
  if (sharpFirst !== null && pinnedEntries.length) {
    const pinnedLagging = pinnedEntries
      .filter(([, entry]) => Number.isFinite(entry.firstMoveTs) && (entry.firstMoveTs as number) - sharpFirst >= 15 * 60 * 1000)
      .map(([bookKey]) => bookKey);

    if (pinnedLagging.length) {
      signals.push({
        label: "pinned lagging",
        severity: pinnedLagging.length >= 2 ? "high" : "medium",
        explanation: "Pinned-book quotes moved later than broader market movement in observed snapshots.",
        evidence: {
          laggingBooks: pinnedLagging,
          sharpBooksMovedFirst: true
        }
      });
    }
  }

  const firstFair = finite(sorted[0]?.fairAmerican);
  const lastFair = finite(sorted[sorted.length - 1]?.fairAmerican);
  if (firstFair !== null && lastFair !== null) {
    const shift = lastFair - firstFair;
    if (Math.abs(shift) >= 8) {
      signals.push({
        label: "broad market shift",
        severity: Math.abs(shift) >= 16 ? "high" : "medium",
        explanation: "Consensus fair line moved meaningfully over the stored timeline.",
        evidence: {
          fairShiftAmerican: shift
        }
      });
    }
  }

  const stale = staleRunSignal(sorted);
  if (stale.laggingBooks.length) {
    signals.push({
      label: "isolated stale quote",
      severity: stale.laggingBooks.length >= 2 ? "medium" : "low",
      explanation: "One or more books stayed materially off-market across multiple snapshots.",
      evidence: {
        laggingBooks: stale.laggingBooks,
        staleDurationMs: stale.staleDurationMs
      }
    });
  }

  return signals;
}

export async function detectMarketPressureForMarket(params: {
  sportKey: string;
  eventId: string;
  marketKey: string;
}): Promise<MarketPressureSignal[]> {
  const timeline = await readMarketTimeline(params.sportKey, params.eventId, params.marketKey);
  return detectMarketPressure(timeline?.points || []);
}

export type MarketPressureRelationshipRow = {
  pressureBucket: "low" | "medium" | "high";
  samples: number;
  avgClvProbDelta: number | null;
  avgROI: number | null;
  likelyClosingRate: number | null;
};

export type MarketPressureRelationshipSummary = {
  sampleSize: number;
  pressureVsCLV: MarketPressureRelationshipRow[];
  pressureVsROI: MarketPressureRelationshipRow[];
  pressureVsTiming: MarketPressureRelationshipRow[];
};

type RelationshipAccumulator = {
  samples: number;
  clvValues: number[];
  roiValues: number[];
  likelyClosingCount: number;
};

function pressureBucket(score: number | null | undefined): "low" | "medium" | "high" {
  if (!Number.isFinite(score)) return "low";
  if ((score as number) >= 0.66) return "high";
  if ((score as number) >= 0.33) return "medium";
  return "low";
}

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function latestEvaluationByValidationId(evaluations: PersistedEvaluationResult[]): Map<string, PersistedEvaluationResult> {
  const byValidationId = new Map<string, PersistedEvaluationResult>();
  for (const evaluation of evaluations) {
    const existing = byValidationId.get(evaluation.validationEventId);
    if (!existing || existing.createdAt < evaluation.createdAt) {
      byValidationId.set(evaluation.validationEventId, evaluation);
    }
  }
  return byValidationId;
}

function clvByReference(evaluation: PersistedEvaluationResult | null, closeReference: CloseReferenceMethod): number | null {
  if (!evaluation) return null;
  if (closeReference === "closing_pinned_best") {
    return Number.isFinite(evaluation.clv.pinned.clvProbDelta) ? Number(evaluation.clv.pinned.clvProbDelta) : null;
  }
  if (closeReference === "closing_sharp_consensus") {
    return Number.isFinite(evaluation.clv.sharpConsensus.clvProbDelta)
      ? Number(evaluation.clv.sharpConsensus.clvProbDelta)
      : Number.isFinite(evaluation.clv.global.clvProbDelta)
        ? Number(evaluation.clv.global.clvProbDelta)
        : null;
  }
  if (closeReference === "closing_fair") {
    return Number.isFinite(evaluation.clv.fair.clvProbDelta)
      ? Number(evaluation.clv.fair.clvProbDelta)
      : Number.isFinite(evaluation.clv.global.clvProbDelta)
        ? Number(evaluation.clv.global.clvProbDelta)
        : null;
  }
  return Number.isFinite(evaluation.clv.global.clvProbDelta) ? Number(evaluation.clv.global.clvProbDelta) : null;
}

function isLikelyClosing(event: PersistedValidationEvent): boolean {
  return (event.diagnostics.reasons || []).some((reason) => reason.toLowerCase().includes("likely closing"));
}

function toRate(hits: number, total: number): number | null {
  if (total <= 0) return null;
  return hits / total;
}

function summarizeAccumulator(
  bucket: "low" | "medium" | "high",
  row: RelationshipAccumulator
): MarketPressureRelationshipRow {
  return {
    pressureBucket: bucket,
    samples: row.samples,
    avgClvProbDelta: avg(row.clvValues),
    avgROI: avg(row.roiValues),
    likelyClosingRate: toRate(row.likelyClosingCount, row.samples)
  };
}

export async function analyzePressureRelationships(
  limit = 500,
  options?: { closeReference?: CloseReferenceMethod }
): Promise<MarketPressureRelationshipSummary> {
  const [events, evaluations] = await Promise.all([listValidationEvents(limit), listEvaluationResults(limit)]);
  const outcomeMap = await buildOutcomeMapForValidationEvents(events);
  return analyzePressureRelationshipsFromData(events, evaluations, outcomeMap, options);
}

export function analyzePressureRelationshipsFromData(
  events: PersistedValidationEvent[],
  evaluations: PersistedEvaluationResult[],
  outcomeMap: Map<string, { result: "win" | "loss" | "push" | "void" | "unknown" }>,
  options?: { closeReference?: CloseReferenceMethod }
): MarketPressureRelationshipSummary {
  const closeReference = options?.closeReference || "closing_global_best";
  const byValidationId = latestEvaluationByValidationId(evaluations);
  const byBucket = new Map<"low" | "medium" | "high", RelationshipAccumulator>([
    ["low", { samples: 0, clvValues: [], roiValues: [], likelyClosingCount: 0 }],
    ["medium", { samples: 0, clvValues: [], roiValues: [], likelyClosingCount: 0 }],
    ["high", { samples: 0, clvValues: [], roiValues: [], likelyClosingCount: 0 }]
  ]);

  for (const event of events) {
    const bucket = pressureBucket(event.diagnostics.stalePenalty);
    const row = byBucket.get(bucket);
    if (!row) continue;
    row.samples += 1;

    if (isLikelyClosing(event)) {
      row.likelyClosingCount += 1;
    }

    const evaluation = byValidationId.get(event.id) || null;
    const clv = clvByReference(evaluation, closeReference);
    if (Number.isFinite(clv)) {
      row.clvValues.push(Number(clv));
    }

    const lookup = buildOutcomeLookupKey({
      sportKey: event.sportKey,
      eventId: event.eventId,
      marketKey: event.marketKey,
      sideKey: event.sideKey || "unknown"
    });
    const outcome = outcomeMap.get(lookup) || null;
    const profit = computeOutcomeProfit(outcome?.result || null, event.execution.displayedPriceAmerican ?? null);
    if (Number.isFinite(profit)) {
      row.roiValues.push(Number(profit));
    }
  }

  const rows: MarketPressureRelationshipRow[] = [
    summarizeAccumulator("low", byBucket.get("low") || { samples: 0, clvValues: [], roiValues: [], likelyClosingCount: 0 }),
    summarizeAccumulator("medium", byBucket.get("medium") || { samples: 0, clvValues: [], roiValues: [], likelyClosingCount: 0 }),
    summarizeAccumulator("high", byBucket.get("high") || { samples: 0, clvValues: [], roiValues: [], likelyClosingCount: 0 })
  ];

  return {
    sampleSize: events.length,
    pressureVsCLV: rows.map((row) => ({
      pressureBucket: row.pressureBucket,
      samples: row.samples,
      avgClvProbDelta: row.avgClvProbDelta,
      avgROI: null,
      likelyClosingRate: null
    })),
    pressureVsROI: rows.map((row) => ({
      pressureBucket: row.pressureBucket,
      samples: row.samples,
      avgClvProbDelta: null,
      avgROI: row.avgROI,
      likelyClosingRate: null
    })),
    pressureVsTiming: rows.map((row) => ({
      pressureBucket: row.pressureBucket,
      samples: row.samples,
      avgClvProbDelta: null,
      avgROI: null,
      likelyClosingRate: row.likelyClosingRate
    }))
  };
}
