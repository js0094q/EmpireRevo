import { NextResponse } from "next/server";
import { internalUnexpectedErrorResponse, isValidationError, validationErrorResponse } from "@/lib/server/odds/apiErrors";
import { authorizeInternalRequest, toInternalAuthError } from "@/lib/server/odds/internalAuth";
import { getPersistenceStatus } from "@/lib/server/odds/persistence";
import { buildMarketTimeline } from "@/lib/server/odds/timeline";
import { detectMarketPressureForMarket } from "@/lib/server/odds/marketPressure";
import { parseBookList, parseOpaqueIdentifier, parseRollingPoints } from "@/lib/server/odds/requestValidation";

export const runtime = "nodejs";

export async function GET(req: Request) {
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

  const persistence = getPersistenceStatus();
  if (!persistence.durable) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "PERSISTENCE_UNAVAILABLE",
          message: "Durable persistence unavailable"
        },
        persistence
      },
      { status: 503 }
    );
  }

  try {
    const url = new URL(req.url);
    const sportKey = parseOpaqueIdentifier(url.searchParams.get("sportKey"), "sportKey", {
      required: true,
      maxLength: 64
    });
    const eventId = parseOpaqueIdentifier(url.searchParams.get("eventId"), "eventId", {
      required: true,
      maxLength: 180
    });
    const marketKey = parseOpaqueIdentifier(url.searchParams.get("marketKey"), "marketKey", {
      required: true,
      maxLength: 140
    });
    const books = parseBookList(url.searchParams.get("books"), 20);

    const timeline = await buildMarketTimeline({
      sportKey,
      eventId,
      marketKey,
      rollingPoints: parseRollingPoints(url.searchParams.get("rolling")),
      bookKeys: books.length ? books : undefined
    });

    const pressureSignals = await detectMarketPressureForMarket({
      sportKey,
      eventId,
      marketKey
    });

    return NextResponse.json({
      ok: true,
      timeline,
      pressureSignals
    });
  } catch (error) {
    if (isValidationError(error)) {
      return validationErrorResponse(error);
    }
    return internalUnexpectedErrorResponse();
  }
}
