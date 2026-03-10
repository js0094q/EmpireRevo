import { NextResponse } from "next/server";
import { cacheStatus } from "@/lib/server/odds/cache";
import { getOddsApiKey } from "@/lib/server/odds/env";

export const runtime = "nodejs";

const START_TIME = Date.now();

async function checkOddsApi(): Promise<{ configured: boolean; reachable: boolean; status?: number }> {
  const apiKey = getOddsApiKey();
  if (!apiKey) {
    return { configured: false, reachable: false };
  }

  const base = process.env.ODDS_API_BASE || "https://api.the-odds-api.com";
  const url = new URL(`${base}/v4/sports`);
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
