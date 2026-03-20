export function getOddsApiKey(): string {
  const raw = process.env.ODDS_API_KEY;
  if (!raw) return "";

  const trimmed = raw.trim();
  if (!trimmed) return "";

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

const DEFAULT_ODDS_API_BASE = "https://api.the-odds-api.com";
const DEFAULT_ALLOWED_ODDS_HOSTS = new Set(["api.the-odds-api.com"]);
const HOSTNAME_PATTERN = /^[a-z0-9.-]+$/;

function normalizeHost(value: string): string {
  return value.trim().toLowerCase();
}

function validHost(value: string): boolean {
  if (!value || value.length > 255) return false;
  if (!HOSTNAME_PATTERN.test(value)) return false;
  if (value.startsWith(".") || value.endsWith(".")) return false;
  return true;
}

function parseAllowedOddsHosts(): Set<string> {
  const configured = (process.env.ODDS_API_ALLOWED_HOSTS || "")
    .split(",")
    .map(normalizeHost)
    .filter(validHost);
  return new Set([...DEFAULT_ALLOWED_ODDS_HOSTS, ...configured]);
}

export function getOddsApiBaseUrl(): URL {
  const fallback = new URL(DEFAULT_ODDS_API_BASE);
  const raw = (process.env.ODDS_API_BASE || "").trim();
  if (!raw) return fallback;

  try {
    const configured = new URL(raw);
    if (configured.protocol !== "https:") return fallback;
    if (configured.username || configured.password) return fallback;
    if (configured.port && configured.port !== "443") return fallback;

    const host = normalizeHost(configured.hostname);
    if (!validHost(host)) return fallback;

    const allowedHosts = parseAllowedOddsHosts();
    if (!allowedHosts.has(host)) {
      return fallback;
    }

    configured.hostname = host;
    configured.port = "";
    configured.pathname = "";
    configured.search = "";
    configured.hash = "";
    return configured;
  } catch {
    return fallback;
  }
}

export function cacheSeconds(defaultSMaxAge: number, defaultSWR: number): {
  sMaxAge: number;
  swr: number;
} {
  const sMaxAge = Number(process.env.EDGE_CACHE_S_MAXAGE || defaultSMaxAge);
  const swr = Number(process.env.EDGE_CACHE_SWR || defaultSWR);
  return {
    sMaxAge: Number.isFinite(sMaxAge) && sMaxAge > 0 ? sMaxAge : defaultSMaxAge,
    swr: Number.isFinite(swr) && swr > 0 ? swr : defaultSWR
  };
}

export function cacheControlHeader(defaultSMaxAge: number, defaultSWR: number): Record<string, string> {
  const { sMaxAge, swr } = cacheSeconds(defaultSMaxAge, defaultSWR);
  return {
    "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`
  };
}
