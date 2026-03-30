import type { MarketKey } from "@/lib/odds/schemas";
import { buildFairEventsForNormalizedEvent } from "@/lib/server/odds/fairEngine";
import { getOddsHistoryConfig } from "@/lib/server/odds/historyConfig";
import { getNormalizedOdds } from "@/lib/server/odds/oddsService";
import { getPersistenceStatus } from "@/lib/server/odds/persistence";
import { persistBoardSnapshots } from "@/lib/server/odds/snapshotPersistence";
import type { WeightModel } from "@/lib/server/odds/weights";

const DEFAULT_MARKETS: MarketKey[] = ["h2h", "spreads", "totals"];

export type SnapshotCollectionSummary = {
  ok: boolean;
  sportKey: string;
  markets: MarketKey[];
  eventsProcessed: number;
  snapshotsWritten: number;
  failures: number;
  durationMs: number;
  fallbackMode: "redis" | "memory";
  durable: boolean;
};

export type SnapshotCollectionAggregateSummary = {
  ok: boolean;
  sportKeys: string[];
  sportSummaries: SnapshotCollectionSummary[];
  markets: MarketKey[];
  eventsProcessed: number;
  snapshotsWritten: number;
  failures: number;
  durationMs: number;
  fallbackMode: "redis" | "memory";
  durable: boolean;
};

export async function collectHistoricalSnapshots(params: {
  sportKey: string;
  regions?: string;
  markets?: MarketKey[];
  model?: WeightModel;
  minBooks?: number;
}): Promise<SnapshotCollectionSummary> {
  const startedAt = Date.now();
  const config = getOddsHistoryConfig();
  const markets = params.markets?.length ? params.markets : DEFAULT_MARKETS;
  const model = params.model || "weighted";
  const minBooks = Math.max(1, params.minBooks ?? 1);
  const normalized = await getNormalizedOdds({
    sportKey: params.sportKey,
    regions: params.regions || "us",
    markets: markets.join(","),
    oddsFormat: "american"
  });

  let eventsProcessed = 0;
  let snapshotsWritten = 0;
  let failures = 0;

  for (const market of markets) {
    const events = normalized.normalized.flatMap((event) =>
      buildFairEventsForNormalizedEvent({
        normalized: event,
        sportKey: normalized.sportKey,
        market,
        model,
        minBooks
      })
    );
    eventsProcessed += events.length;
    if (!events.length) continue;

    for (let idx = 0; idx < events.length; idx += config.batchSize) {
      const batch = await persistBoardSnapshots({
        sportKey: normalized.sportKey,
        events: events.slice(idx, idx + config.batchSize),
        capturedAt: startedAt
      });
      snapshotsWritten += batch.written;
      failures += batch.failures;
    }
  }

  const persistence = getPersistenceStatus();
  return {
    ok: failures === 0,
    sportKey: normalized.sportKey,
    markets,
    eventsProcessed,
    snapshotsWritten,
    failures,
    durationMs: Date.now() - startedAt,
    fallbackMode: persistence.mode,
    durable: persistence.durable
  };
}

export async function collectHistoricalSnapshotsForSportKeys(params: {
  sportKeys: string[];
  regions?: string;
  markets?: MarketKey[];
  model?: WeightModel;
  minBooks?: number;
}): Promise<SnapshotCollectionAggregateSummary> {
  const startedAt = Date.now();
  const sportKeys = params.sportKeys.length ? params.sportKeys : ["basketball_nba"];
  const sportSummaries: SnapshotCollectionSummary[] = [];

  for (const sportKey of sportKeys) {
    sportSummaries.push(
      await collectHistoricalSnapshots({
        sportKey,
        regions: params.regions,
        markets: params.markets,
        model: params.model,
        minBooks: params.minBooks
      })
    );
  }

  const persistence = getPersistenceStatus();
  return {
    ok: sportSummaries.every((summary) => summary.ok),
    sportKeys,
    sportSummaries,
    markets: params.markets?.length ? params.markets : DEFAULT_MARKETS,
    eventsProcessed: sportSummaries.reduce((sum, summary) => sum + summary.eventsProcessed, 0),
    snapshotsWritten: sportSummaries.reduce((sum, summary) => sum + summary.snapshotsWritten, 0),
    failures: sportSummaries.reduce((sum, summary) => sum + summary.failures, 0),
    durationMs: Date.now() - startedAt,
    fallbackMode: persistence.mode,
    durable: persistence.durable
  };
}
