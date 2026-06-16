import type { LeagueKey } from "@/lib/odds/schemas";

export type LeagueCategory =
  | "baseball"
  | "basketball"
  | "football"
  | "hockey"
  | "soccer"
  | "tennis"
  | "golf"
  | "mma"
  | "other";

export type LeagueConfig = {
  key: LeagueKey;
  sportKey: string;
  label: string;
  category: LeagueCategory;
  group: "Featured" | "Baseball" | "Basketball" | "Football" | "Hockey" | "Soccer" | "Combat" | "Other";
  priority: number;
  enabledByDefault: boolean;
  supportsStandardMarkets: boolean;
  notes?: string;
};

export const LEAGUE_REGISTRY: LeagueConfig[] = [
  {
    key: "mlb",
    sportKey: "baseball_mlb",
    label: "MLB",
    category: "baseball",
    group: "Featured",
    priority: 10,
    enabledByDefault: true,
    supportsStandardMarkets: true
  },
  {
    key: "college_baseball",
    sportKey: "baseball_ncaa",
    label: "College Baseball",
    category: "baseball",
    group: "Featured",
    priority: 20,
    enabledByDefault: true,
    supportsStandardMarkets: true,
    notes: "The Odds API lists NCAA Baseball as baseball_ncaa; tolerate empty feeds when out of season."
  },
  {
    key: "wnba",
    sportKey: "basketball_wnba",
    label: "WNBA",
    category: "basketball",
    group: "Featured",
    priority: 30,
    enabledByDefault: true,
    supportsStandardMarkets: true
  },
  {
    key: "mma",
    sportKey: "mma_mixed_martial_arts",
    label: "MMA / UFC",
    category: "mma",
    group: "Combat",
    priority: 40,
    enabledByDefault: true,
    supportsStandardMarkets: true
  },
  {
    key: "soccer_mls",
    sportKey: "soccer_usa_mls",
    label: "MLS",
    category: "soccer",
    group: "Soccer",
    priority: 50,
    enabledByDefault: true,
    supportsStandardMarkets: true
  },
  {
    key: "soccer_epl",
    sportKey: "soccer_epl",
    label: "EPL",
    category: "soccer",
    group: "Soccer",
    priority: 60,
    enabledByDefault: true,
    supportsStandardMarkets: true
  },
  {
    key: "soccer_ucl",
    sportKey: "soccer_uefa_champs_league",
    label: "Champions League",
    category: "soccer",
    group: "Soccer",
    priority: 70,
    enabledByDefault: true,
    supportsStandardMarkets: true
  },
  {
    key: "tennis_atp_wimbledon",
    sportKey: "tennis_atp_wimbledon",
    label: "ATP Wimbledon",
    category: "tennis",
    group: "Other",
    priority: 80,
    enabledByDefault: true,
    supportsStandardMarkets: true,
    notes: "Use league-specific views only; tennis market compatibility should be verified before broader ranking."
  },
  {
    key: "tennis_wta_wimbledon",
    sportKey: "tennis_wta_wimbledon",
    label: "WTA Wimbledon",
    category: "tennis",
    group: "Other",
    priority: 90,
    enabledByDefault: true,
    supportsStandardMarkets: true,
    notes: "Use league-specific views only; tennis market compatibility should be verified before broader ranking."
  },
  {
    key: "nfl",
    sportKey: "americanfootball_nfl",
    label: "NFL",
    category: "football",
    group: "Football",
    priority: 110,
    enabledByDefault: true,
    supportsStandardMarkets: true
  },
  {
    key: "ncaaf",
    sportKey: "americanfootball_ncaaf",
    label: "College Football",
    category: "football",
    group: "Football",
    priority: 120,
    enabledByDefault: true,
    supportsStandardMarkets: true
  },
  {
    key: "nba",
    sportKey: "basketball_nba",
    label: "NBA",
    category: "basketball",
    group: "Basketball",
    priority: 130,
    enabledByDefault: true,
    supportsStandardMarkets: true
  },
  {
    key: "ncaab",
    sportKey: "basketball_ncaab",
    label: "NCAAB",
    category: "basketball",
    group: "Basketball",
    priority: 140,
    enabledByDefault: true,
    supportsStandardMarkets: true
  },
  {
    key: "nhl",
    sportKey: "icehockey_nhl",
    label: "NHL",
    category: "hockey",
    group: "Hockey",
    priority: 220,
    enabledByDefault: true,
    supportsStandardMarkets: true,
    notes: "Keep available, but do not make hockey the summer default unless explicitly configured."
  },
  {
    key: "golf_us_open",
    sportKey: "golf_us_open_winner",
    label: "Golf Outrights",
    category: "golf",
    group: "Other",
    priority: 300,
    enabledByDefault: false,
    supportsStandardMarkets: false,
    notes: "Outrights do not fit the current paired no-vig EV board; keep out of default board views."
  }
];

export const DEFAULT_LEAGUE_KEY: LeagueKey = "mlb";
export const DEFAULT_SPORT_KEY = "baseball_mlb";

export function getLeagueConfig(value: string | null | undefined): LeagueConfig | null {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return null;
  return LEAGUE_REGISTRY.find((league) => league.key === normalized || league.sportKey === normalized) ?? null;
}

export function leagueToSportKeyFromRegistry(league: LeagueKey): string {
  return getLeagueConfig(league)?.sportKey ?? DEFAULT_SPORT_KEY;
}

export function sportKeyToLeagueFromRegistry(sportKey: string): LeagueKey {
  return getLeagueConfig(sportKey)?.key ?? DEFAULT_LEAGUE_KEY;
}

export function defaultEnabledLeagues(): LeagueConfig[] {
  return LEAGUE_REGISTRY.filter((league) => league.enabledByDefault && league.supportsStandardMarkets).sort((a, b) => a.priority - b.priority);
}

export function configuredOrDefaultSportKeys(): Set<string> {
  const configured = (process.env.ODDS_ALLOWED_SPORT_KEYS || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (configured.length) {
    return new Set(configured);
  }

  return new Set(defaultEnabledLeagues().map((league) => league.sportKey));
}
