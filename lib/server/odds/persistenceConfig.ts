import { getOddsHistoryConfig } from "@/lib/server/odds/historyConfig";

export type PersistenceTtlConfig = {
  rawSnapshotSeconds: number;
  timelineSeconds: number;
  validationEventSeconds: number;
  evaluationSeconds: number;
  diagnosticsSeconds: number;
};

const DEFAULT_TTLS: PersistenceTtlConfig = {
  rawSnapshotSeconds: 10 * 24 * 60 * 60,
  timelineSeconds: 21 * 24 * 60 * 60,
  validationEventSeconds: 60 * 24 * 60 * 60,
  evaluationSeconds: 60 * 24 * 60 * 60,
  diagnosticsSeconds: 24 * 60 * 60
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  return rounded > 0 ? rounded : fallback;
}

let cached: PersistenceTtlConfig | null = null;

export function getPersistenceTtls(): PersistenceTtlConfig {
  if (cached) return cached;

  const historyConfig = getOddsHistoryConfig();
  const retentionSeconds = Math.max(1, Math.floor(historyConfig.retentionHours * 60 * 60));

  cached = {
    rawSnapshotSeconds: parsePositiveInt(process.env.ODDS_SNAPSHOT_TTL_SECONDS, retentionSeconds || DEFAULT_TTLS.rawSnapshotSeconds),
    timelineSeconds: parsePositiveInt(process.env.ODDS_TIMELINE_TTL_SECONDS, retentionSeconds || DEFAULT_TTLS.timelineSeconds),
    validationEventSeconds: parsePositiveInt(process.env.ODDS_VALIDATION_TTL_SECONDS, DEFAULT_TTLS.validationEventSeconds),
    evaluationSeconds: parsePositiveInt(process.env.ODDS_EVALUATION_TTL_SECONDS, DEFAULT_TTLS.evaluationSeconds),
    diagnosticsSeconds: parsePositiveInt(process.env.ODDS_DIAGNOSTICS_TTL_SECONDS, DEFAULT_TTLS.diagnosticsSeconds)
  };

  return cached;
}

export function resetPersistenceTtlsForTests(): void {
  cached = null;
}

export const DEFAULT_PERSISTENCE_TTLS = DEFAULT_TTLS;
