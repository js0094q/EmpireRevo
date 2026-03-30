export type OddsHistoryConfig = {
  collectionEnabled: boolean;
  intervalSeconds: number;
  retentionHours: number;
  batchSize: number;
  shortWindowMinutes: number;
  longWindowMinutes: number;
  valuePersistenceThresholdPct: number;
  liveRankingMode: "off" | "conservative" | "full";
};

const DEFAULT_HISTORY_CONFIG: OddsHistoryConfig = {
  collectionEnabled: false,
  intervalSeconds: 60,
  retentionHours: 72,
  batchSize: 500,
  shortWindowMinutes: 5,
  longWindowMinutes: 30,
  valuePersistenceThresholdPct: 1,
  liveRankingMode: "conservative"
};

let cached: OddsHistoryConfig | null = null;

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  return rounded > 0 ? rounded : fallback;
}

function parseNonNegativeNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed >= 0 ? parsed : fallback;
}

function parseLiveRankingMode(
  value: string | undefined,
  fallback: OddsHistoryConfig["liveRankingMode"]
): OddsHistoryConfig["liveRankingMode"] {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "off" || normalized === "conservative" || normalized === "full") {
    return normalized;
  }
  return fallback;
}

export function getOddsHistoryConfig(): OddsHistoryConfig {
  if (cached) return cached;

  cached = {
    collectionEnabled: parseBoolean(
      process.env.ODDS_SNAPSHOT_COLLECTION_ENABLED,
      DEFAULT_HISTORY_CONFIG.collectionEnabled
    ),
    intervalSeconds: parsePositiveInt(
      process.env.ODDS_SNAPSHOT_INTERVAL_SECONDS,
      DEFAULT_HISTORY_CONFIG.intervalSeconds
    ),
    retentionHours: parsePositiveInt(
      process.env.ODDS_SNAPSHOT_RETENTION_HOURS,
      DEFAULT_HISTORY_CONFIG.retentionHours
    ),
    batchSize: parsePositiveInt(process.env.ODDS_SNAPSHOT_BATCH_SIZE, DEFAULT_HISTORY_CONFIG.batchSize),
    shortWindowMinutes: parsePositiveInt(
      process.env.ODDS_HISTORY_SHORT_WINDOW_MINUTES,
      DEFAULT_HISTORY_CONFIG.shortWindowMinutes
    ),
    longWindowMinutes: parsePositiveInt(
      process.env.ODDS_HISTORY_LONG_WINDOW_MINUTES,
      DEFAULT_HISTORY_CONFIG.longWindowMinutes
    ),
    valuePersistenceThresholdPct: parseNonNegativeNumber(
      process.env.ODDS_VALUE_PERSISTENCE_THRESHOLD_PCT,
      DEFAULT_HISTORY_CONFIG.valuePersistenceThresholdPct
    ),
    liveRankingMode: parseLiveRankingMode(
      process.env.ODDS_HISTORY_LIVE_RANKING_MODE,
      DEFAULT_HISTORY_CONFIG.liveRankingMode
    )
  };

  if (cached.longWindowMinutes < cached.shortWindowMinutes) {
    cached.longWindowMinutes = cached.shortWindowMinutes;
  }

  return cached;
}

export function resetOddsHistoryConfigForTests(): void {
  cached = null;
}

export const DEFAULT_ODDS_HISTORY_CONFIG = DEFAULT_HISTORY_CONFIG;
