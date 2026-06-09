import { NextResponse } from "next/server";
import { internalUnexpectedErrorResponse } from "@/lib/server/odds/apiErrors";
import { authorizeInternalRequest, toInternalAuthError } from "@/lib/server/odds/internalAuth";
import { getPersistenceStatus } from "@/lib/server/odds/persistence";
import { listOutcomeResults, persistOutcomeResult } from "@/lib/server/odds/outcomes";
import type { OutcomeResult } from "@/lib/server/odds/types";

export const runtime = "nodejs";

const VALID_RESULTS = new Set<OutcomeResult>(["win", "loss", "push", "void", "unknown"]);

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readResult(value: unknown): OutcomeResult | null {
  const result = readString(value) as OutcomeResult;
  return VALID_RESULTS.has(result) ? result : null;
}

function validationError(message: string) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "INVALID_OUTCOME_PAYLOAD",
        message
      }
    },
    { status: 400 }
  );
}

export async function GET(req: Request) {
  const auth = authorizeInternalRequest(req);
  if (!auth.ok) {
    const authError = toInternalAuthError(auth);
    return NextResponse.json({ ok: false, error: authError }, { status: auth.status });
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

  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(1000, Number(url.searchParams.get("limit") || "500") || 500));
  const outcomes = await listOutcomeResults(limit);
  return NextResponse.json({ ok: true, outcomes });
}

export async function POST(req: Request) {
  const auth = authorizeInternalRequest(req);
  if (!auth.ok) {
    const authError = toInternalAuthError(auth);
    return NextResponse.json({ ok: false, error: authError }, { status: auth.status });
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
    const body = (await req.json()) as Record<string, unknown>;
    const sportKey = readString(body.sportKey);
    const eventId = readString(body.eventId);
    const marketKey = readString(body.marketKey);
    const sideKey = readString(body.sideKey);
    const result = readResult(body.result);

    if (!sportKey || !eventId || !marketKey || !sideKey) {
      return validationError("sportKey, eventId, marketKey, and sideKey are required");
    }
    if (!result) {
      return validationError("result must be win, loss, push, void, or unknown");
    }

    const outcome = await persistOutcomeResult({
      sportKey,
      eventId,
      marketKey,
      sideKey,
      result,
      finalScore: readString(body.finalScore) || null,
      closeTimestamp: readString(body.closeTimestamp) || new Date().toISOString(),
      source: "manual"
    });

    return NextResponse.json({ ok: true, outcome });
  } catch {
    return internalUnexpectedErrorResponse();
  }
}
