import { fetchSportsFromUpstream, type OddsApiSport } from "@/lib/server/odds/client";

const SPORT_KEY_PATTERN = /^[a-z0-9_]+$/;
const SPORTS_TTL_MS = 5 * 60 * 1000;

export type PublicSportOption = {
  key: string;
  sportKey: string;
  label: string;
  group: string;
  active: boolean;
  source: "feed" | "configured";
};

const KNOWN_SPORTS: PublicSportOption[] = [
  { key: "nfl", sportKey: "americanfootball_nfl", label: "NFL", group: "Football", active: true, source: "configured" },
  { key: "nba", sportKey: "basketball_nba", label: "NBA", group: "Basketball", active: true, source: "configured" },
  { key: "ncaab", sportKey: "basketball_ncaab", label: "NCAAB", group: "Basketball", active: true, source: "configured" },
  { key: "mlb", sportKey: "baseball_mlb", label: "MLB", group: "Baseball", active: true, source: "configured" },
  { key: "nhl", sportKey: "icehockey_nhl", label: "NHL", group: "Hockey", active: true, source: "configured" }
];

let cachedSports: { expiresAt: number; value: PublicSportOption[] } | null = null;

function configuredAllowedSports(): Set<string> {
  const configured = (process.env.ODDS_ALLOWED_SPORT_KEYS || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0 && entry.length <= 64 && SPORT_KEY_PATTERN.test(entry));

  if (configured.length) return new Set(configured);
  return new Set(KNOWN_SPORTS.map((sport) => sport.sportKey));
}

function labelForSport(sport: OddsApiSport): string {
  const known = KNOWN_SPORTS.find((entry) => entry.sportKey === sport.key);
  if (known) return known.label;
  return sport.title.replace(/\bNCAA\b/i, "NCAA").replace(/\bMLB\b/i, "MLB").replace(/\bNBA\b/i, "NBA").replace(/\bNFL\b/i, "NFL");
}

function groupForSport(sport: OddsApiSport): string {
  const known = KNOWN_SPORTS.find((entry) => entry.sportKey === sport.key);
  if (known) return known.group;
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
  const known = KNOWN_SPORTS.find((entry) => entry.sportKey === sportKey);
  if (known) return known.key;
  return sportKey.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function fallbackSports(): PublicSportOption[] {
  const allowed = configuredAllowedSports();
  return KNOWN_SPORTS.filter((sport) => allowed.has(sport.sportKey));
}

function normalizeFeedSports(feedSports: OddsApiSport[]): PublicSportOption[] {
  const allowed = configuredAllowedSports();
  const options = feedSports
    .filter((sport) => sport.active && allowed.has(sport.key) && KNOWN_SPORTS.some((known) => known.sportKey === sport.key))
    .map((sport) => ({
      key: keyForSport(sport.key),
      sportKey: sport.key,
      label: labelForSport(sport),
      group: groupForSport(sport),
      active: true,
      source: "feed" as const
    }));

  return options.sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
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
  return sports.find((sport) => sport.key === normalized || sport.sportKey === normalized) ?? sports[0] ?? KNOWN_SPORTS[1]!;
}

export function toSportKey(league: string): string {
  const normalized = (league || "").trim().toLowerCase();
  return KNOWN_SPORTS.find((sport) => sport.key === normalized || sport.sportKey === normalized)?.sportKey ?? KNOWN_SPORTS[1]!.sportKey;
}
