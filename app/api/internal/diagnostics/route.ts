import { NextResponse } from "next/server";
import { authorizeInternalRequest } from "@/lib/server/odds/internalAuth";
import { getInternalDiagnostics } from "@/lib/server/odds/internalDiagnostics";

export const runtime = "nodejs";

function parseLimit(value: string | null, fallback = 400): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(25, Math.min(1000, Math.floor(parsed)));
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

  try {
    const url = new URL(req.url);
    const limit = parseLimit(url.searchParams.get("limit"), 400);
    const payload = await getInternalDiagnostics(limit);
    if (!payload.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "PERSISTENCE_UNAVAILABLE",
            message: payload.unavailableReason || "Durable persistence unavailable"
          },
          persistence: payload.persistence,
          persistenceHealth: payload.persistenceHealth
        },
        { status: 503 }
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected internal diagnostics error";
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
