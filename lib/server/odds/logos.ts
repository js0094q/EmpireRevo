import type { LeagueKey } from "@/lib/odds/schemas";

export type TeamLogoMap = Record<string, string>;

type TeamLogoEntry = {
  league: Exclude<LeagueKey, "ncaab">;
  canonical: string;
  sportPath: "nba" | "nfl" | "nhl" | "mlb";
  code: string;
  aliases?: string[];
};

function espnLogoUrl(sportPath: TeamLogoEntry["sportPath"], code: string): string {
  return `https://a.espncdn.com/i/teamlogos/${sportPath}/500/${code}.png`;
}

export function normalizeTeamName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/['’.]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function automaticAliases(canonical: string): string[] {
  const aliases = new Set<string>([canonical]);
  const parts = canonical.split(/\s+/).filter(Boolean);

  if (parts.length > 1) aliases.add(parts.slice(-1).join(" "));
  if (parts.length > 2) aliases.add(parts.slice(-2).join(" "));

  const replacements: Array<[string, string]> = [
    ["Los Angeles ", "LA "],
    ["New York ", "NY "],
    ["New Orleans ", "NO "],
    ["New England ", "NE "],
    ["New Jersey ", "NJ "],
    ["Kansas City ", "KC "],
    ["Oklahoma City ", "OKC "],
    ["Golden State ", "GS "],
    ["San Antonio ", "SA "],
    ["San Francisco ", "SF "],
    ["San Diego ", "SD "],
    ["St. Louis ", "STL "],
    ["Tampa Bay ", "TB "],
    ["Green Bay ", "GB "],
    ["Washington ", "WAS "]
  ];

  for (const [from, to] of replacements) {
    if (canonical.startsWith(from)) aliases.add(canonical.replace(from, to));
  }

  return Array.from(aliases);
}

function entry(league: Exclude<LeagueKey, "ncaab">, canonical: string, sportPath: TeamLogoEntry["sportPath"], code: string, aliases: string[] = []): TeamLogoEntry {
  return { league, canonical, sportPath, code, aliases };
}

const TEAM_LOGO_ENTRIES: TeamLogoEntry[] = [
  entry("nba", "Atlanta Hawks", "nba", "atl"),
  entry("nba", "Boston Celtics", "nba", "bos"),
  entry("nba", "Brooklyn Nets", "nba", "bkn", ["Nets"]),
  entry("nba", "Charlotte Hornets", "nba", "cha"),
  entry("nba", "Chicago Bulls", "nba", "chi"),
  entry("nba", "Cleveland Cavaliers", "nba", "cle", ["Cavs"]),
  entry("nba", "Dallas Mavericks", "nba", "dal", ["Mavs"]),
  entry("nba", "Denver Nuggets", "nba", "den"),
  entry("nba", "Detroit Pistons", "nba", "det"),
  entry("nba", "Golden State Warriors", "nba", "gs", ["Warriors"]),
  entry("nba", "Houston Rockets", "nba", "hou"),
  entry("nba", "Indiana Pacers", "nba", "ind"),
  entry("nba", "Los Angeles Clippers", "nba", "lac", ["LA Clippers", "Clippers"]),
  entry("nba", "Los Angeles Lakers", "nba", "lal", ["LA Lakers", "Lakers"]),
  entry("nba", "Memphis Grizzlies", "nba", "mem", ["Grizzlies"]),
  entry("nba", "Miami Heat", "nba", "mia"),
  entry("nba", "Milwaukee Bucks", "nba", "mil"),
  entry("nba", "Minnesota Timberwolves", "nba", "min", ["Timberwolves", "Wolves"]),
  entry("nba", "New Orleans Pelicans", "nba", "no", ["Pelicans", "NO Pelicans"]),
  entry("nba", "New York Knicks", "nba", "ny", ["Knicks", "NY Knicks"]),
  entry("nba", "Oklahoma City Thunder", "nba", "okc", ["Thunder"]),
  entry("nba", "Orlando Magic", "nba", "orl"),
  entry("nba", "Philadelphia 76ers", "nba", "phi", ["76ers", "Sixers", "Philadelphia Sixers"]),
  entry("nba", "Phoenix Suns", "nba", "phx"),
  entry("nba", "Portland Trail Blazers", "nba", "por", ["Trail Blazers", "Blazers"]),
  entry("nba", "Sacramento Kings", "nba", "sac"),
  entry("nba", "San Antonio Spurs", "nba", "sa", ["Spurs"]),
  entry("nba", "Toronto Raptors", "nba", "tor"),
  entry("nba", "Utah Jazz", "nba", "utah"),
  entry("nba", "Washington Wizards", "nba", "wsh", ["Wizards"]),

  entry("nfl", "Arizona Cardinals", "nfl", "ari", ["Cardinals"]),
  entry("nfl", "Atlanta Falcons", "nfl", "atl", ["Falcons"]),
  entry("nfl", "Baltimore Ravens", "nfl", "bal", ["Ravens"]),
  entry("nfl", "Buffalo Bills", "nfl", "buf", ["Bills"]),
  entry("nfl", "Carolina Panthers", "nfl", "car", ["Panthers"]),
  entry("nfl", "Chicago Bears", "nfl", "chi", ["Bears"]),
  entry("nfl", "Cincinnati Bengals", "nfl", "cin", ["Bengals"]),
  entry("nfl", "Cleveland Browns", "nfl", "cle", ["Browns"]),
  entry("nfl", "Dallas Cowboys", "nfl", "dal", ["Cowboys"]),
  entry("nfl", "Denver Broncos", "nfl", "den", ["Broncos"]),
  entry("nfl", "Detroit Lions", "nfl", "det", ["Lions"]),
  entry("nfl", "Green Bay Packers", "nfl", "gb", ["Packers", "GB Packers"]),
  entry("nfl", "Houston Texans", "nfl", "hou", ["Texans"]),
  entry("nfl", "Indianapolis Colts", "nfl", "ind", ["Colts"]),
  entry("nfl", "Jacksonville Jaguars", "nfl", "jax", ["Jaguars", "Jags"]),
  entry("nfl", "Kansas City Chiefs", "nfl", "kc", ["Chiefs", "KC Chiefs"]),
  entry("nfl", "Las Vegas Raiders", "nfl", "lv", ["Raiders"]),
  entry("nfl", "Los Angeles Chargers", "nfl", "lac", ["LA Chargers", "Chargers"]),
  entry("nfl", "Los Angeles Rams", "nfl", "lar", ["LA Rams", "Rams"]),
  entry("nfl", "Miami Dolphins", "nfl", "mia", ["Dolphins"]),
  entry("nfl", "Minnesota Vikings", "nfl", "min", ["Vikings"]),
  entry("nfl", "New England Patriots", "nfl", "ne", ["Patriots", "NE Patriots"]),
  entry("nfl", "New Orleans Saints", "nfl", "no", ["Saints", "NO Saints"]),
  entry("nfl", "New York Giants", "nfl", "nyg", ["Giants", "NY Giants"]),
  entry("nfl", "New York Jets", "nfl", "nyj", ["Jets", "NY Jets"]),
  entry("nfl", "Philadelphia Eagles", "nfl", "phi", ["Eagles"]),
  entry("nfl", "Pittsburgh Steelers", "nfl", "pit", ["Steelers"]),
  entry("nfl", "Seattle Seahawks", "nfl", "sea", ["Seahawks"]),
  entry("nfl", "San Francisco 49ers", "nfl", "sf", ["49ers", "Niners", "SF 49ers"]),
  entry("nfl", "Tampa Bay Buccaneers", "nfl", "tb", ["Buccaneers", "Bucs", "TB Buccaneers"]),
  entry("nfl", "Tennessee Titans", "nfl", "ten", ["Titans"]),
  entry("nfl", "Washington Commanders", "nfl", "wsh", ["Commanders", "Washington Football Team", "Washington Redskins"]),

  entry("nhl", "Anaheim Ducks", "nhl", "ana", ["Ducks"]),
  entry("nhl", "Boston Bruins", "nhl", "bos", ["Bruins"]),
  entry("nhl", "Buffalo Sabres", "nhl", "buf", ["Sabres"]),
  entry("nhl", "Carolina Hurricanes", "nhl", "car", ["Hurricanes", "Canes"]),
  entry("nhl", "Columbus Blue Jackets", "nhl", "cbj", ["Blue Jackets", "Jackets"]),
  entry("nhl", "Calgary Flames", "nhl", "cgy", ["Flames"]),
  entry("nhl", "Chicago Blackhawks", "nhl", "chi", ["Blackhawks", "Hawks"]),
  entry("nhl", "Colorado Avalanche", "nhl", "col", ["Avalanche", "Avs"]),
  entry("nhl", "Dallas Stars", "nhl", "dal", ["Stars"]),
  entry("nhl", "Detroit Red Wings", "nhl", "det", ["Red Wings", "Wings"]),
  entry("nhl", "Edmonton Oilers", "nhl", "edm", ["Oilers"]),
  entry("nhl", "Florida Panthers", "nhl", "fla", ["Panthers"]),
  entry("nhl", "Los Angeles Kings", "nhl", "la", ["LA Kings", "Kings"]),
  entry("nhl", "Minnesota Wild", "nhl", "min", ["Wild"]),
  entry("nhl", "Montreal Canadiens", "nhl", "mtl", ["Canadiens", "Habs"]),
  entry("nhl", "New Jersey Devils", "nhl", "nj", ["Devils", "NJ Devils"]),
  entry("nhl", "Nashville Predators", "nhl", "nsh", ["Predators", "Preds"]),
  entry("nhl", "New York Islanders", "nhl", "nyi", ["Islanders", "NY Islanders", "Isles"]),
  entry("nhl", "New York Rangers", "nhl", "nyr", ["Rangers", "NY Rangers"]),
  entry("nhl", "Ottawa Senators", "nhl", "ott", ["Senators", "Sens"]),
  entry("nhl", "Philadelphia Flyers", "nhl", "phi", ["Flyers"]),
  entry("nhl", "Pittsburgh Penguins", "nhl", "pit", ["Penguins", "Pens"]),
  entry("nhl", "Seattle Kraken", "nhl", "sea", ["Kraken"]),
  entry("nhl", "San Jose Sharks", "nhl", "sj", ["Sharks"]),
  entry("nhl", "St. Louis Blues", "nhl", "stl", ["Saint Louis Blues", "Blues"]),
  entry("nhl", "Tampa Bay Lightning", "nhl", "tb", ["Lightning"]),
  entry("nhl", "Toronto Maple Leafs", "nhl", "tor", ["Maple Leafs", "Leafs"]),
  entry("nhl", "Utah Hockey Club", "nhl", "utah", ["Utah HC", "Utah"]),
  entry("nhl", "Vancouver Canucks", "nhl", "van", ["Canucks"]),
  entry("nhl", "Vegas Golden Knights", "nhl", "vgk", ["Golden Knights", "Knights"]),
  entry("nhl", "Winnipeg Jets", "nhl", "wpg", ["Jets"]),
  entry("nhl", "Washington Capitals", "nhl", "wsh", ["Capitals", "Caps"]),

  entry("mlb", "Arizona Diamondbacks", "mlb", "ari", ["Diamondbacks", "Dbacks", "D-Backs"]),
  entry("mlb", "Atlanta Braves", "mlb", "atl", ["Braves"]),
  entry("mlb", "Baltimore Orioles", "mlb", "bal", ["Orioles", "Os"]),
  entry("mlb", "Boston Red Sox", "mlb", "bos", ["Red Sox"]),
  entry("mlb", "Chicago Cubs", "mlb", "chc", ["Cubs"]),
  entry("mlb", "Chicago White Sox", "mlb", "cws", ["White Sox"]),
  entry("mlb", "Cincinnati Reds", "mlb", "cin", ["Reds"]),
  entry("mlb", "Cleveland Guardians", "mlb", "cle", ["Guardians", "Cleveland Indians"]),
  entry("mlb", "Colorado Rockies", "mlb", "col", ["Rockies"]),
  entry("mlb", "Detroit Tigers", "mlb", "det", ["Tigers"]),
  entry("mlb", "Houston Astros", "mlb", "hou", ["Astros"]),
  entry("mlb", "Kansas City Royals", "mlb", "kc", ["Royals", "KC Royals"]),
  entry("mlb", "Los Angeles Angels", "mlb", "laa", ["LA Angels", "Angels", "Anaheim Angels"]),
  entry("mlb", "Los Angeles Dodgers", "mlb", "lad", ["LA Dodgers", "Dodgers"]),
  entry("mlb", "Miami Marlins", "mlb", "mia", ["Marlins", "Florida Marlins"]),
  entry("mlb", "Milwaukee Brewers", "mlb", "mil", ["Brewers"]),
  entry("mlb", "Minnesota Twins", "mlb", "min", ["Twins"]),
  entry("mlb", "New York Mets", "mlb", "nym", ["Mets", "NY Mets"]),
  entry("mlb", "New York Yankees", "mlb", "nyy", ["Yankees", "NY Yankees"]),
  entry("mlb", "Athletics", "mlb", "oak", ["Oakland Athletics", "As", "A's"]),
  entry("mlb", "Philadelphia Phillies", "mlb", "phi", ["Phillies", "Phils"]),
  entry("mlb", "Pittsburgh Pirates", "mlb", "pit", ["Pirates"]),
  entry("mlb", "San Diego Padres", "mlb", "sd", ["Padres"]),
  entry("mlb", "Seattle Mariners", "mlb", "sea", ["Mariners", "Ms"]),
  entry("mlb", "San Francisco Giants", "mlb", "sf", ["Giants", "SF Giants"]),
  entry("mlb", "St. Louis Cardinals", "mlb", "stl", ["Saint Louis Cardinals", "Cardinals"]),
  entry("mlb", "Tampa Bay Rays", "mlb", "tb", ["Rays"]),
  entry("mlb", "Texas Rangers", "mlb", "tex", ["Rangers"]),
  entry("mlb", "Toronto Blue Jays", "mlb", "tor", ["Blue Jays", "Jays"]),
  entry("mlb", "Washington Nationals", "mlb", "wsh", ["Nationals", "Nats"])
];

type LogoRegistry = {
  logoMap: TeamLogoMap;
  aliasesByLeague: Record<Exclude<LeagueKey, "ncaab">, Record<string, string>>;
};

function buildLogoRegistry(entries: TeamLogoEntry[]): LogoRegistry {
  const logoMap: TeamLogoMap = {};
  const aliasesByLeague: LogoRegistry["aliasesByLeague"] = {
    nba: {},
    nfl: {},
    nhl: {},
    mlb: {}
  };
  const automaticCandidates = new Map<Exclude<LeagueKey, "ncaab">, Map<string, Set<string>>>([
    ["nba", new Map()],
    ["nfl", new Map()],
    ["nhl", new Map()],
    ["mlb", new Map()]
  ]);

  for (const entry of entries) {
    logoMap[entry.canonical] = espnLogoUrl(entry.sportPath, entry.code);
    const explicitAliases = new Set<string>([entry.canonical, ...(entry.aliases || [])]);
    for (const alias of explicitAliases) {
      aliasesByLeague[entry.league][normalizeTeamName(alias)] = entry.canonical;
    }

    for (const alias of automaticAliases(entry.canonical)) {
      const key = normalizeTeamName(alias);
      const leagueMap = automaticCandidates.get(entry.league)!;
      const candidates = leagueMap.get(key) || new Set<string>();
      candidates.add(entry.canonical);
      leagueMap.set(key, candidates);
    }
  }

  for (const [league, leagueMap] of automaticCandidates.entries()) {
    for (const [alias, candidates] of leagueMap.entries()) {
      if (aliasesByLeague[league][alias] || candidates.size !== 1) continue;
      aliasesByLeague[league][alias] = Array.from(candidates)[0]!;
    }
  }

  return {
    logoMap,
    aliasesByLeague
  };
}

const LOGO_REGISTRY = buildLogoRegistry(TEAM_LOGO_ENTRIES);

export const TEAM_LOGO_MAP: TeamLogoMap = LOGO_REGISTRY.logoMap;

export function canonicalizeTeamName(name: string, league?: LeagueKey): string {
  const normalized = normalizeTeamName(name);
  if (league && league !== "ncaab") {
    return LOGO_REGISTRY.aliasesByLeague[league][normalized] || name.trim().replace(/\s+/g, " ");
  }

  for (const aliases of Object.values(LOGO_REGISTRY.aliasesByLeague)) {
    const canonical = aliases[normalized];
    if (canonical) return canonical;
  }

  return name.trim().replace(/\s+/g, " ");
}

export function resolveTeamLogo(name: string, league?: LeagueKey, teamLogoMap: TeamLogoMap = TEAM_LOGO_MAP): string | undefined {
  const canonical = canonicalizeTeamName(name, league);
  return teamLogoMap[canonical] || teamLogoMap[name.trim()];
}
