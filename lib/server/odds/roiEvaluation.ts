import { listValidationEvents } from "@/lib/server/odds/validationStore";
import { buildOutcomeLookupKey, getOutcomeResult } from "@/lib/server/odds/outcomes";
import { confidenceTierForSampleSize } from "@/lib/server/odds/sampleConfidence";
import type { OutcomeResult, PersistedOutcomeResult, PersistedValidationEvent, SampleConfidenceTier } from "@/lib/server/odds/types";

export type RoiRow = {
  validationEventId: string;
  outcomeResult: OutcomeResult | null;
  edgePct: number | null;
  profit: number | null;
};

export type RoiSummary = {
  sampleSize: number;
  settledSampleSize: number;
  confidenceTier: SampleConfidenceTier;
  roi: number | null;
  unitsWon: number | null;
  winRate: number | null;
  averageEdge: number | null;
  outcomes: {
    win: number;
    loss: number;
    push: number;
    void: number;
    unknown: number;
  };
};

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function americanWinProfit(american: number): number | null {
  if (!Number.isFinite(american)) return null;
  if (american > 0) return american / 100;
  if (american < 0) return 100 / Math.abs(american);
  return null;
}

function toOutcomeLookup(event: Pick<PersistedValidationEvent, "sportKey" | "eventId" | "marketKey" | "sideKey">): string {
  return buildOutcomeLookupKey({
    sportKey: event.sportKey,
    eventId: event.eventId,
    marketKey: event.marketKey,
    sideKey: event.sideKey || "unknown"
  });
}

export async function buildOutcomeMapForValidationEvents(
  events: Array<Pick<PersistedValidationEvent, "sportKey" | "eventId" | "marketKey" | "sideKey">>
): Promise<Map<string, PersistedOutcomeResult>> {
  const lookups = new Map<string, { sportKey: string; eventId: string; marketKey: string; sideKey: string }>();
  for (const event of events) {
    const lookup = toOutcomeLookup(event);
    if (lookups.has(lookup)) continue;
    lookups.set(lookup, {
      sportKey: event.sportKey,
      eventId: event.eventId,
      marketKey: event.marketKey,
      sideKey: event.sideKey || "unknown"
    });
  }

  const rows = await Promise.all(
    Array.from(lookups.values()).map(async (lookup) => {
      return getOutcomeResult({
        sportKey: lookup.sportKey,
        eventId: lookup.eventId,
        marketKey: lookup.marketKey,
        sideKey: lookup.sideKey
      });
    })
  );

  const out = new Map<string, PersistedOutcomeResult>();
  for (const row of rows) {
    if (!row) continue;
    out.set(row.id, row);
  }
  return out;
}

export function computeOutcomeProfit(
  result: OutcomeResult | null | undefined,
  displayedPriceAmerican: number | null | undefined
): number | null {
  if (result === "loss") return -1;
  if (result === "push" || result === "void") return 0;
  if (result === "unknown" || !result) return null;

  const payout = americanWinProfit(Number(displayedPriceAmerican));
  if (result === "win") {
    return payout;
  }

  return null;
}

export function summarizeRoiRows(rows: RoiRow[]): RoiSummary {
  const profits: number[] = [];
  const edges: number[] = [];
  let wins = 0;
  let losses = 0;
  let pushes = 0;
  let voids = 0;
  let unknown = 0;

  for (const row of rows) {
    const result = row.outcomeResult;
    if (result === "win") wins += 1;
    else if (result === "loss") losses += 1;
    else if (result === "push") pushes += 1;
    else if (result === "void") voids += 1;
    else unknown += 1;

    if (Number.isFinite(row.profit)) {
      profits.push(Number(row.profit));
      if (Number.isFinite(row.edgePct)) {
        edges.push(Number(row.edgePct));
      }
    }
  }

  const settledSampleSize = profits.length;
  const unitsWon = settledSampleSize ? profits.reduce((sum, value) => sum + value, 0) : null;
  const roi = settledSampleSize && unitsWon !== null ? unitsWon / settledSampleSize : null;
  const decisionCount = wins + losses;

  return {
    sampleSize: rows.length,
    settledSampleSize,
    confidenceTier: confidenceTierForSampleSize(settledSampleSize > 0 ? settledSampleSize : rows.length),
    roi,
    unitsWon,
    winRate: decisionCount > 0 ? wins / decisionCount : null,
    averageEdge: avg(edges),
    outcomes: {
      win: wins,
      loss: losses,
      push: pushes,
      void: voids,
      unknown
    }
  };
}

export function buildRoiRowsFromData(
  events: PersistedValidationEvent[],
  outcomeMap: Map<string, PersistedOutcomeResult>
): RoiRow[] {
  return events.map((event) => {
    const outcome = outcomeMap.get(toOutcomeLookup(event)) || null;
    const profit = computeOutcomeProfit(outcome?.result || null, event.execution.displayedPriceAmerican ?? null);
    return {
      validationEventId: event.id,
      outcomeResult: outcome?.result || null,
      edgePct: Number.isFinite(event.model.evPct) ? Number(event.model.evPct) : null,
      profit
    };
  });
}

export async function summarizeRoiForValidationEvents(events: PersistedValidationEvent[]): Promise<RoiSummary> {
  const outcomeMap = await buildOutcomeMapForValidationEvents(events);
  const rows = buildRoiRowsFromData(events, outcomeMap);
  return summarizeRoiRows(rows);
}

export async function getRoiSummary(limit = 300): Promise<RoiSummary> {
  const events = await listValidationEvents(limit);
  return summarizeRoiForValidationEvents(events);
}
