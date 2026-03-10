import { NextResponse } from "next/server";
import { authorizeInternalRequest } from "@/lib/server/odds/internalAuth";
import { getPersistenceStatus } from "@/lib/server/odds/persistence";
import { buildMarketTimeline } from "@/lib/server/odds/timeline";
import { detectMarketPressureForMarket } from "@/lib/server/odds/marketPressure";

export const runtime = "nodejs";

function parseRolling(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(1, Math.floor(parsed));
}

export async function GET(req: Request) {
  const auth = authorizeInternalRequest(req);
  if (!auth.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: auth.code,
          message: auth.message
        }
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
    const sportKey = url.searchParams.get("sportKey") || "";
    const eventId = url.searchParams.get("eventId") || "";
    const marketKey = url.searchParams.get("marketKey") || "";

    if (!sportKey || !eventId || !marketKey) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "BAD_REQUEST",
            message: "sportKey, eventId, and marketKey are required"
          }
        },
        { status: 400 }
      );
    }

    const books = (url.searchParams.get("books") || "")
      .split(",")
      .map((book) => book.trim())
      .filter(Boolean);

    const timeline = await buildMarketTimeline({
      sportKey,
      eventId,
      marketKey,
      rollingPoints: parseRolling(url.searchParams.get("rolling")),
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
    const message = error instanceof Error ? error.message : "Unexpected internal timeline error";
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "UNEXPECTED_ERROR",
          message
        }
      },
      { status: 500 }
    );
  }
}
