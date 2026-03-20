import type { LeagueKey } from "@/lib/odds/schemas";
import { getOddsApiBaseUrl, getOddsApiKey } from "@/lib/server/odds/env";

const UPSTREAM_TIMEOUT_MS = 5000;
const MAX_UPSTREAM_ATTEMPTS = 2;

export function leagueToSportKey(league: LeagueKey): string {
  switch (league) {
    case "nfl":
      return "americanfootball_nfl";
    case "nba":
      return "basketball_nba";
    case "nhl":
      return "icehockey_nhl";
    case "ncaab":
      return "basketball_ncaab";
    case "mlb":
      return "baseball_mlb";
    default:
      return "basketball_nba";
  }
}

export function sportKeyToLeague(sportKey: string): LeagueKey {
  if (sportKey.includes("nfl")) return "nfl";
  if (sportKey.includes("nba")) return "nba";
  if (sportKey.includes("nhl")) return "nhl";
  if (sportKey.includes("ncaab")) return "ncaab";
  if (sportKey.includes("mlb")) return "mlb";
  return "nba";
}

export async function fetchOddsFromUpstream(params: {
  sportKey: string;
  regions: string;
  markets: string;
  oddsFormat?: string;
}): Promise<any[]> {
  const apiKey = getOddsApiKey();
  if (!apiKey) {
    const err = new Error("Missing ODDS_API_KEY");
    (err as Error & { code?: string }).code = "MISSING_KEY";
    throw err;
  }

  const base = getOddsApiBaseUrl();
  const upstream = new URL(`/v4/sports/${encodeURIComponent(params.sportKey)}/odds`, base);
  upstream.searchParams.set("regions", params.regions);
  upstream.searchParams.set("markets", params.markets);
  upstream.searchParams.set("oddsFormat", params.oddsFormat || "american");
  upstream.searchParams.set("apiKey", apiKey);

  const response = await fetchWithRetry(upstream.toString());

  const text = await response.text();
  if (!response.ok) {
    const err = new Error(`Upstream error ${response.status}`);
    const e = err as Error & { code?: string };
    if (response.status === 401 || response.status === 403) {
      e.code = "UPSTREAM_AUTH_FAILURE";
    } else if (response.status === 429) {
      e.code = "UPSTREAM_RATE_LIMIT";
    } else {
      e.code = "UPSTREAM_ERROR";
    }
    throw err;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const err = new Error("Upstream payload is not valid JSON");
    (err as Error & { code?: string }).code = "UPSTREAM_EMPTY_PAYLOAD";
    throw err;
  }
  if (!Array.isArray(parsed)) {
    const err = new Error("Upstream payload is not an array");
    (err as Error & { code?: string }).code = "UPSTREAM_EMPTY_PAYLOAD";
    throw err;
  }
  return parsed;
}

async function fetchWithRetry(url: string): Promise<Response> {
  let lastFailure: unknown = null;
  for (let attempt = 1; attempt <= MAX_UPSTREAM_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, UPSTREAM_TIMEOUT_MS);
      if (response.status >= 500 && attempt < MAX_UPSTREAM_ATTEMPTS) {
        await wait(100 * attempt);
        continue;
      }
      return response;
    } catch (error) {
      lastFailure = error;
      if (attempt < MAX_UPSTREAM_ATTEMPTS) {
        await wait(100 * attempt);
        continue;
      }
    }
  }

  const err = new Error("Upstream service unavailable");
  const e = err as Error & { code?: string; cause?: unknown };
  e.code = "UPSTREAM_UNAVAILABLE";
  e.cause = lastFailure;
  throw err;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
  } finally {
    clearTimeout(timer);
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
