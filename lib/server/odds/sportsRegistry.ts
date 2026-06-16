import { fetchSportsFromUpstream, type OddsApiSport } from "@/lib/server/odds/client";
import {
  DEFAULT_LEAGUE_KEY,
  DEFAULT_SPORT_KEY,
  LEAGUE_REGISTRY,
  configuredOrDefaultSportKeys,
  defaultEnabledLeagues,
  getLeagueConfig,
  type LeagueConfig
} from "@/lib/server/odds/sportConfig";

const SPORT_KEY_PATTERN = /^[a-z0-9_]+$/;
const SPORTS_TTL_MS = 5 * 60 * 1000;

export type PublicSportOption = {
  key: string;
  sportKey: string;
  label: string;
  group: string;
  active: boolean;
  source: "feed" | "configured";
  priority: number;
  supportsStandardMarkets: boolean;
  notes?: string;
};

let cachedSports: { expiresAt: number; value: PublicSportOption[] } | null = null;

function isValidConfiguredSportKey(sportKey: string): boolean {
  return sportKey.length > 0 && sportKey.length <= 64 && SPORT_KEY_PATTERN.test(sportKey);
}

function toPublicOption(config: LeagueConfig, source: PublicSportOption["source"], active = true): PublicSportOption {
  return {
    key: config.key,
    sportKey: config.sportKey,
    label: config.label,
    group: config.group,
    active,
    source,
    priority: config.priority,
    supportsStandardMarkets: config.supportsStandardMarkets,
    notes: config.notes
  };
}

function labelForSport(sport: OddsApiSport, config: LeagueConfig | null): string {
  if (config) return config.label;
  return sport.title.replace(/\bNCAA\b/i, "NCAA").replace(/\bMLB\b/i, "MLB").replace(/\bNBA\b/i, "NBA").replace(/\bNFL\b/i, "NFL");
}

function groupForSport(sport: OddsApiSport, config: LeagueConfig | null): string {
  if (config) return config.group;
  const group = sport.group.trim();
  if (group) return group;
  if (sport.key.startsWith("basketball_")) return "Basketball";
  if (sport.key.startsWith("americanfootball_")) return "Football";
  if (sport.key.startsWith("baseball_")) return "Baseball";
  if (sport.key.startsWith("icehockey_")) return "Hockey";
  if (sport.key.startsWith("soccer_")) return "Soccer";
  return "Other";
}

function keyForSport(sportKey: string): string {
  const known = getLeagueConfig(sportKey);
  if (known) return known.key;
  return sportKey.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function fallbackSports(): PublicSportOption[] {
  const allowed = configuredOrDefaultSportKeys();
  const configured = LEAGUE_REGISTRY.filter((sport) => allowed.has(sport.sportKey) && sport.supportsStandardMarkets).map((sport) =>
    toPublicOption(sport, "configured")
  );
  return configured.length ? configured.sort((a, b) => a.priority - b.priority) : defaultEnabledLeagues().map((sport) => toPublicOption(sport, "configured"));
}

function normalizeFeedSports(feedSports: OddsApiSport[]): PublicSportOption[] {
  const allowed = configuredOrDefaultSportKeys();
  const options = feedSports
    .filter((sport) => sport.active && allowed.has(sport.key) && isValidConfiguredSportKey(sport.key))
    .flatMap((sport) => {
      const config = getLeagueConfig(sport.key);
      if (config && !config.supportsStandardMarkets) return [];
      return [
        {
          key: keyForSport(sport.key),
          sportKey: sport.key,
          label: labelForSport(sport, config),
          group: groupForSport(sport, config),
          active: true,
          source: "feed" as const,
          priority: config?.priority ?? 999,
          supportsStandardMarkets: config?.supportsStandardMarkets ?? true,
          notes: config?.notes
        }
      ];
    });

  return options.sort((a, b) => a.priority - b.priority || a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
}

export async function getPublicSportOptions(): Promise<PublicSportOption[]> {
  const now = Date.now();
  if (cachedSports && cachedSports.expiresAt > now) return cachedSports.value;

  let options = fallbackSports();
  try {
    const feedSports = await fetchSportsFromUpstream();
    const discovered = normalizeFeedSports(feedSports);
    if (discovered.length) options = discovered;
  } catch {
    options = fallbackSports();
  }

  cachedSports = { expiresAt: now + SPORTS_TTL_MS, value: options };
  return options;
}

export function resolveSportOption(league: string | null | undefined, sports: PublicSportOption[]): PublicSportOption {
  const normalized = (league || "").trim().toLowerCase();
  const explicit = sports.find((sport) => sport.key === normalized || sport.sportKey === normalized);
  if (explicit) return explicit;

  const configuredDefault = getLeagueConfig(process.env.NEXT_PUBLIC_DEFAULT_LEAGUE);
  if (configuredDefault) {
    const configured = sports.find((sport) => sport.key === configuredDefault.key || sport.sportKey === configuredDefault.sportKey);
    if (configured) return configured;
  }

  return sports[0] ?? toPublicOption(getLeagueConfig(DEFAULT_LEAGUE_KEY)!, "configured");
}

export function toSportKey(league: string): string {
  const normalized = (league || "").trim().toLowerCase();
  return getLeagueConfig(normalized)?.sportKey ?? DEFAULT_SPORT_KEY;
}
