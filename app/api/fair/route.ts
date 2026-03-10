import { NextResponse } from "next/server";
import type { MarketKey } from "@/lib/odds/schemas";
import { cacheControlHeader } from "@/lib/server/odds/env";
import { getFairBoard } from "@/lib/server/odds/oddsService";

export const runtime = "nodejs";

type ModelParam = "sharp" | "equal" | "weighted";

function parseMarket(value: string | null): MarketKey {
  if (value === "spreads" || value === "totals") return value;
  return "h2h";
}

function parseModel(value: string | null): ModelParam {
  if (value === "sharp" || value === "equal" || value === "weighted") {
    return value;
  }
  return "weighted";
}

function parseBoundedInt(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sportKey = url.searchParams.get("sportKey") || "basketball_nba";
  const market = parseMarket(url.searchParams.get("market"));
  const model = parseModel(url.searchParams.get("model"));
  const regions = url.searchParams.get("regions") || "us";
  const minBooks = parseBoundedInt(url.searchParams.get("minBooks"), 4, 2, 25);
  const windowHours = parseBoundedInt(url.searchParams.get("windowHours"), 24, 1, 72);
  const historyWindowHours = parseBoundedInt(url.searchParams.get("historyWindowHours"), 24, 1, 72);
  const retentionHours = Math.max(24, Math.min(7 * 24, historyWindowHours * 3));

  const includeBooksRaw = url.searchParams.get("books") || "";
  const includeBooksEntries = includeBooksRaw
    .split(",")
    .map((book) => book.trim().toLowerCase())
    .filter(Boolean);
  const includeBooks = includeBooksEntries.length ? new Set(includeBooksEntries) : undefined;

  try {
    const payload = await getFairBoard({
      sportKey,
      regions,
      markets: "h2h,spreads,totals",
      market,
      model,
      minBooks,
      includeBooks,
      windowHours,
      historyWindowHours,
      retentionHours
    });
    return NextResponse.json(payload, { headers: cacheControlHeader(30, 120) });
  } catch (error) {
    const e = error as Error & { code?: string; status?: number; body?: string };
    if (e.code === "MISSING_KEY") {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "MISSING_KEY",
            message: "Missing ODDS_API_KEY"
          }
        },
        { status: 500 }
      );
    }

    if (e.code === "UPSTREAM_AUTH_FAILURE") {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "UPSTREAM_AUTH_FAILURE",
            message: "Upstream authentication failed"
          }
        },
        { status: 502 }
      );
    }

    if (e.code === "UPSTREAM_RATE_LIMIT") {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "UPSTREAM_RATE_LIMIT",
            message: "Upstream rate limit reached"
          }
        },
        { status: 429 }
      );
    }

    if (e.code === "UPSTREAM_EMPTY_PAYLOAD") {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "UPSTREAM_EMPTY_PAYLOAD",
            message: "Upstream returned an empty payload"
          }
        },
        { status: 502 }
      );
    }

    if (e.code === "UPSTREAM_ERROR") {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "UPSTREAM_ERROR",
            message: `Upstream error ${e.status || 502}${e.body ? ` – ${e.body}` : ""}`
          }
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "UNEXPECTED_ERROR",
          message: e.message || "Unexpected server error"
        }
      },
      { status: 500 }
    );
  }
}
