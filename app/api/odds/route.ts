import { NextResponse } from "next/server";
import { errorPayload, isValidationError, mapPublicError, publicErrorResponse, validationErrorResponse } from "@/lib/server/odds/apiErrors";
import { cacheControlHeader } from "@/lib/server/odds/env";
import { getAggregatedOdds } from "@/lib/server/odds/aggregator";
import { authorizeInternalRequest, toInternalAuthError } from "@/lib/server/odds/internalAuth";
import {
  parseIntegerParam,
  parseMarket,
  parseOddsFormat,
  parseRegionsCsv,
  parseResponseFormat,
  parseSportKey
} from "@/lib/server/odds/requestValidation";

export const runtime = "nodejs";
const RAW_MAX_RESPONSE_BYTES = 512 * 1024;

function limitRawPayload(events: unknown[], maxBytes: number): { events: unknown[]; truncated: boolean } {
  const included: unknown[] = [];
  let estimatedBytes = 2; // []

  for (const event of events) {
    const serialized = JSON.stringify(event);
    if (!serialized) continue;
    const eventBytes = Buffer.byteLength(serialized, "utf8");
    const delimiterBytes = included.length ? 1 : 0;
    if (estimatedBytes + delimiterBytes + eventBytes > maxBytes) {
      break;
    }
    included.push(event);
    estimatedBytes += delimiterBytes + eventBytes;
  }

  return {
    events: included,
    truncated: included.length < events.length
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const sportKey = parseSportKey(url.searchParams.get("sportKey"), "basketball_nba");
    const regions = parseRegionsCsv(url.searchParams.get("regions"), "us");
    const market = parseMarket(url.searchParams.get("market") || url.searchParams.get("markets"), "h2h");
    const oddsFormat = parseOddsFormat(url.searchParams.get("oddsFormat"), "american");
    const responseFormat = parseResponseFormat(url.searchParams.get("format"));
    const rawLimit = parseIntegerParam({
      name: "rawLimit",
      value: url.searchParams.get("rawLimit"),
      fallback: 25,
      min: 1,
      max: 100
    });

    if (responseFormat === "raw") {
      const auth = authorizeInternalRequest(req);
      if (!auth.ok) {
        const authError = toInternalAuthError(auth);
        return NextResponse.json(errorPayload(authError.code, authError.message), {
          status: auth.status,
          headers: { "Cache-Control": "no-store" }
        });
      }
    }

    const aggregated = await getAggregatedOdds({
      sportKey,
      market,
      regions,
      oddsFormat
    });

    if (responseFormat === "raw") {
      const requestedEvents = aggregated.rawEvents.slice(0, rawLimit);
      const capped = limitRawPayload(requestedEvents, RAW_MAX_RESPONSE_BYTES);
      return NextResponse.json(
        {
          ok: true,
          events: capped.events,
          truncated: aggregated.rawEvents.length > capped.events.length
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      {
        games: aggregated.games,
        updated: aggregated.updated,
        sportKey: aggregated.sportKey,
        market: aggregated.market,
        marketLabel: aggregated.marketLabel
      },
      { headers: cacheControlHeader(15, 60) }
    );
  } catch (error) {
    if (isValidationError(error)) {
      return validationErrorResponse(error);
    }

    const mapped = mapPublicError(error);
    return publicErrorResponse(mapped);
  }
}
