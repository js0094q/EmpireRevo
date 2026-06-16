import type { LeagueKey } from "@/lib/odds/schemas";
import { getOddsApiBaseUrl, getOddsApiKey } from "@/lib/server/odds/env";
import { leagueToSportKeyFromRegistry, sportKeyToLeagueFromRegistry } from "@/lib/server/odds/sportConfig";

const UPSTREAM_TIMEOUT_MS = 5000;
const MAX_UPSTREAM_ATTEMPTS = 2;

export function leagueToSportKey(league: LeagueKey): string {
  return leagueToSportKeyFromRegistry(league);
}

export function sportKeyToLeague(sportKey: string): LeagueKey {
  return sportKeyToLeagueFromRegistry(sportKey);
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

export async function fetchEventOddsFromUpstream(params: {
  sportKey: string;
  eventId: string;
  regions: string;
  markets: string;
  oddsFormat?: string;
}): Promise<unknown> {
  const apiKey = getOddsApiKey();
  if (!apiKey) {
    const err = new Error("Missing ODDS_API_KEY");
    (err as Error & { code?: string }).code = "MISSING_KEY";
    throw err;
  }

  const base = getOddsApiBaseUrl();
  const upstream = new URL(`/v4/sports/${encodeURIComponent(params.sportKey)}/events/${encodeURIComponent(params.eventId)}/odds`, base);
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

  try {
    return JSON.parse(text);
  } catch {
    const err = new Error("Upstream payload is not valid JSON");
    (err as Error & { code?: string }).code = "UPSTREAM_EMPTY_PAYLOAD";
    throw err;
  }
}

export type OddsApiSport = {
  key: string;
  group: string;
  title: string;
  description?: string;
  active: boolean;
  has_outrights?: boolean;
};

export async function fetchSportsFromUpstream(): Promise<OddsApiSport[]> {
  const apiKey = getOddsApiKey();
  if (!apiKey) {
    const err = new Error("Missing ODDS_API_KEY");
    (err as Error & { code?: string }).code = "MISSING_KEY";
    throw err;
  }

  const base = getOddsApiBaseUrl();
  const upstream = new URL("/v4/sports", base);
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
  return parsed
    .map((entry: any) => ({
      key: String(entry.key || ""),
      group: String(entry.group || "Other"),
      title: String(entry.title || entry.key || "Unknown"),
      description: entry.description === undefined ? undefined : String(entry.description),
      active: Boolean(entry.active),
      has_outrights: entry.has_outrights === undefined ? undefined : Boolean(entry.has_outrights)
    }))
    .filter((entry) => entry.key.length > 0);
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
