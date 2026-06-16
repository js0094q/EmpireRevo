import { NextResponse } from "next/server";
import { isValidationError, mapPublicError, publicErrorResponse, validationErrorResponse } from "@/lib/server/odds/apiErrors";
import { cacheControlHeader } from "@/lib/server/odds/env";
import { resolveMarketRequest } from "@/lib/server/odds/marketSupport";
import { fetchPropsBoardData, type PropsBoardData } from "@/lib/server/odds/propsService";
import { DEFAULT_LEAGUE_KEY } from "@/lib/server/odds/sportConfig";
import { getPropsDisplayState } from "@/lib/ui/propsDisplay";
import { parseBookList, parseLeague, parseOpaqueIdentifier, parsePropType, parseRegionsCsv } from "@/lib/server/odds/requestValidation";

export const runtime = "nodejs";

type PropsApiResponse = PropsBoardData & {
  ok: true;
  emptyState: ReturnType<typeof getPropsDisplayState>;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const league = parseLeague(url.searchParams.get("league"), DEFAULT_LEAGUE_KEY);
    const propType = parsePropType(url.searchParams.get("propType"), "player");
    const regions = parseRegionsCsv(url.searchParams.get("regions"), "us");
    const books = parseBookList(url.searchParams.get("books"), 20);
    const eventId = parseOpaqueIdentifier(url.searchParams.get("eventId"), "eventId", {
      maxLength: 180
    });
    const resolution = resolveMarketRequest({
      scope: "props",
      propType,
      league,
      eventId
    });

    if (resolution.fetchMode === "event" && !eventId) {
      const emptyState = getPropsDisplayState({
        reason: "EVENT_REQUIRED",
        leagueLabel: resolution.leagueLabel,
        propType
      });
      const response: PropsApiResponse = {
        ok: true,
        rows: [],
        emptyReason: "EVENT_REQUIRED",
        marketFamily: resolution.marketFamily,
        propType,
        fetchMode: resolution.fetchMode,
        requestedMarkets: resolution.markets,
        failures: 0,
        emptyState
      };
      return NextResponse.json(response, { headers: cacheControlHeader(15, 30) });
    }

    const data = await fetchPropsBoardData({
      league,
      propType,
      events: eventId
        ? [
            {
              providerEventId: eventId,
              routeEventId: eventId,
              sportKey: resolution.sportKey,
              commenceTime: "",
              homeTeam: "",
              awayTeam: ""
            }
          ]
        : [],
      regions,
      books,
      maxEvents: 1,
      maxMarkets: 5
    });
    const emptyState = getPropsDisplayState({
      reason: data.emptyReason,
      leagueLabel: resolution.leagueLabel,
      propType
    });
    const response: PropsApiResponse = {
      ok: true,
      ...data,
      emptyState
    };
    return NextResponse.json(response, { headers: cacheControlHeader(15, 30) });
  } catch (error) {
    if (isValidationError(error)) {
      return validationErrorResponse(error);
    }

    const mapped = mapPublicError(error);
    return publicErrorResponse(mapped);
  }
}
