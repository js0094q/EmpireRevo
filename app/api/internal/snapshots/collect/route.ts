import { NextResponse } from "next/server";
import { internalUnexpectedErrorResponse, isValidationError, validationErrorResponse } from "@/lib/server/odds/apiErrors";
import { getOddsHistoryConfig } from "@/lib/server/odds/historyConfig";
import { authorizeInternalRequest, toInternalAuthError } from "@/lib/server/odds/internalAuth";
import { collectHistoricalSnapshots } from "@/lib/server/odds/snapshots";
import { parseMarketsCsv, parseRegionsCsv, parseSportKey } from "@/lib/server/odds/requestValidation";

export const runtime = "nodejs";

function parseEnabledBypass(value: string | null): boolean {
  const normalized = (value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

async function handle(req: Request) {
  const auth = authorizeInternalRequest(req);
  if (!auth.ok) {
    const authError = toInternalAuthError(auth);
    return NextResponse.json(
      {
        ok: false,
        error: authError
      },
      { status: auth.status }
    );
  }

  try {
    const url = new URL(req.url);
    const config = getOddsHistoryConfig();
    const force = parseEnabledBypass(url.searchParams.get("force"));

    if (!config.collectionEnabled && !force) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "SNAPSHOT_COLLECTION_DISABLED",
            message: "Historical snapshot collection is disabled"
          },
          config
        },
        { status: 409 }
      );
    }

    const sportKey = parseSportKey(url.searchParams.get("sportKey"), "basketball_nba");
    const regions = parseRegionsCsv(url.searchParams.get("regions"), "us");
    const markets = parseMarketsCsv(url.searchParams.get("markets"), "h2h,spreads,totals")
      .split(",")
      .filter((value): value is "h2h" | "spreads" | "totals" => value === "h2h" || value === "spreads" || value === "totals");

    const summary = await collectHistoricalSnapshots({
      sportKey,
      regions,
      markets
    });

    return NextResponse.json({
      ok: true,
      sportKey: summary.sportKey,
      markets: summary.markets,
      eventsProcessed: summary.eventsProcessed,
      snapshotsWritten: summary.snapshotsWritten,
      failures: summary.failures,
      durationMs: summary.durationMs,
      fallbackMode: summary.fallbackMode,
      durable: summary.durable,
      configuredIntervalSeconds: config.intervalSeconds
    });
  } catch (error) {
    if (isValidationError(error)) {
      return validationErrorResponse(error);
    }
    return internalUnexpectedErrorResponse();
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
