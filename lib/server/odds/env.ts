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
