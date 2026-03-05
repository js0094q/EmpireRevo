import { NextResponse } from "next/server";
import { cacheGet, cacheKey, cacheSet } from "@/lib/server/odds/cache";
import { fetchOddsFromUpstream, sportKeyToLeague } from "@/lib/server/odds/client";
import { cacheControlHeader } from "@/lib/server/odds/env";
import { normalizeOddsApiResponse } from "@/lib/server/odds/normalize";
import { buildFairBoard } from "@/lib/server/odds/fairEngine";
import { trackMovement } from "@/lib/server/odds/movement";

export const runtime = "nodejs";

function parseMarket(value: string | null): "h2h" | "spreads" | "totals" {
  if (value === "spreads" || value === "totals") return value;
  return "h2h";
}

function parseModel(value: string | null): "sharp" | "equal" {
  return value === "equal" ? "equal" : "sharp";
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
  const includeBooks = new Set(
    includeBooksRaw
      .split(",")
      .map((book) => book.trim())
      .filter(Boolean)
  );

  const key = cacheKey([
    "fair",
    sportKey,
    market,
    model,
    regions,
    minBooks,
    windowHours,
    historyWindowHours,
    Array.from(includeBooks).sort().join(",")
  ]);
  const hit = await cacheGet<any>(key);
  if (hit) return NextResponse.json(hit, { headers: cacheControlHeader(30, 120) });

  try {
    const raw = await fetchOddsFromUpstream({
      sportKey,
      regions,
      markets: "h2h,spreads,totals",
      oddsFormat: "american"
    });

    const league = sportKeyToLeague(sportKey);
    const normalized = normalizeOddsApiResponse({ league, raw });
    const payload = buildFairBoard({
      normalized,
      league,
      sportKey,
      market,
      model,
      minBooks,
      includeBooks,
      timeWindowHours: windowHours
    });

    await Promise.all(
      payload.events.map(async (event) => {
        await Promise.all(
          event.outcomes.map(async (outcome) => {
            await Promise.all(
              outcome.books.map(async (book) => {
                const movement = await trackMovement(
                  `${event.id}|${market}|${outcome.name}|${book.bookKey}|${book.point ?? "na"}`,
                  book.priceAmerican,
                  {
                    windowMs: historyWindowHours * 60 * 60 * 1000,
                    retentionMs: retentionHours * 60 * 60 * 1000,
                    maxPoints: 1200
                  }
                );
                book.movement = movement;
              })
            );
          })
        );
      })
    );

    await cacheSet(key, payload, 30_000);
    return NextResponse.json(payload, { headers: cacheControlHeader(30, 120) });
  } catch (error) {
    const e = error as Error & { code?: string; status?: number; body?: string };

    if (e.code === "MISSING_KEY") {
      return NextResponse.json({ error: "Missing ODDS_API_KEY" }, { status: 500 });
    }

    if (e.code === "UPSTREAM_ERROR") {
      return NextResponse.json(
        {
          error: "Upstream error",
          status: e.status || 502,
          body: e.body || ""
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        error: "Unexpected server error",
        message: e.message
      },
      { status: 500 }
    );
  }
}
