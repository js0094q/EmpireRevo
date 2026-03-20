import { NextResponse } from "next/server";
import { cacheStatus } from "@/lib/server/odds/cache";
import { getOddsApiBaseUrl, getOddsApiKey } from "@/lib/server/odds/env";

export const runtime = "nodejs";

const START_TIME = Date.now();

async function checkOddsApi(): Promise<{ configured: boolean; reachable: boolean; status?: number }> {
  const apiKey = getOddsApiKey();
  if (!apiKey) {
    return { configured: false, reachable: false };
  }

  const base = getOddsApiBaseUrl();
  const url = new URL("/v4/sports", base);
  url.searchParams.set("apiKey", apiKey);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
    clearTimeout(timer);

    return {
      configured: true,
      reachable: response.ok,
      status: response.status
    };
  } catch {
    return {
      configured: true,
      reachable: false
    };
  }
}

export async function GET() {
  const oddsApi = await checkOddsApi();
  const cache = cacheStatus();

  return NextResponse.json({
    ok: true,
    uptimeSec: Math.floor((Date.now() - START_TIME) / 1000),
    odds_api_status: oddsApi,
    cache_status: cache,
    startedAt: new Date(START_TIME).toISOString()
  });
}
