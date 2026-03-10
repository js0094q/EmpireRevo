import { NextResponse } from "next/server";
import { cacheStatus } from "@/lib/server/odds/cache";
import { getOddsApiKey } from "@/lib/server/odds/env";

export const runtime = "nodejs";

export async function GET() {
  const cache = cacheStatus();
  return NextResponse.json({
    ok: true,
    oddsApiConfigured: Boolean(getOddsApiKey()),
    cacheProvider: cache.provider
  });
}
