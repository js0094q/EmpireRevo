import { NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/lib/odds/cache";
import { normalizeOddsApiResponse } from "@/lib/odds/normalize";
import { deriveGames } from "@/lib/odds/derive";
import type { BoardResponse, LeagueKey, DerivedGame } from "@/lib/odds/schemas";

export const runtime = "nodejs";

const DEFAULT_BASE = "https://api.the-odds-api.com";
const movementState = {
  openByKey: {} as Record<string, number>,
  prevByKey: {} as Record<string, number>
};

function boardCacheHeaders(): Record<string, string> {
  const sMaxAge = process.env.EDGE_CACHE_S_MAXAGE || "30";
  const swr = process.env.EDGE_CACHE_SWR || "120";
  return {
    "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`
  };
}

function toSportKey(league: LeagueKey): string {
  switch (league) {
    case "nfl":
      return "americanfootball_nfl";
    case "nba":
      return "basketball_nba";
    case "nhl":
      return "icehockey_nhl";
    case "ncaab":
      return "basketball_ncaab";
    case "mlb":
      return "baseball_mlb";
    default:
      return "americanfootball_nfl";
  }
}

function topEv(game: DerivedGame): number {
  let best = -999;
  for (const m of game.markets) {
    for (const s of m.sides) {
      if (s.evPct > best) best = s.evPct;
    }
  }
  return best;
}

function summarizeEditorNote(comingUp: DerivedGame[], best: DerivedGame[]) {
  const first = comingUp[0];
  const top = best[0];
  const firstMatch = first
    ? `${first.event.away.name} at ${first.event.home.name}`
    : "No marquee games currently available";
  const topMatch = top ? `${top.event.away.name} at ${top.event.home.name}` : "No clear edge board";

  return {
    headline: "Live Market Brief",
    body: `The board is active with line reshaping across major books. ${firstMatch} is nearest to kickoff, while ${topMatch} is showing the strongest weighted signal right now.`,
    watchlist: [
      "Watch games where sharp-weighted lean diverges by more than 2.0 percentage points.",
      "Check rapid movement (bolt) tags before locking in price."
    ],
    lockLike: [
      "Highest confidence setup only when confidence is High and lean is sustained across updates."
    ]
  };
}

function buildFeed(games: DerivedGame[]): BoardResponse["feed"] {
  const out: BoardResponse["feed"] = [];
  for (const g of games) {
    for (const m of g.markets) {
      for (const s of m.sides) {
        if (s.movement.icon === "bolt") {
          out.push({
            id: `${g.event.id}-${m.market}-${s.label}-rapid`,
            ts: new Date().toISOString(),
            type: "rapid_move",
            title: `${s.label} moved rapidly`,
            subtitle: `${g.event.away.name} @ ${g.event.home.name} (${m.market.toUpperCase()})`,
            gameId: g.event.id,
            market: m.market,
            confidence: s.confidence
          });
        }
        if (s.evPct > 2) {
          out.push({
            id: `${g.event.id}-${m.market}-${s.label}-ev`,
            ts: new Date().toISOString(),
            type: "ev_edge",
            title: `${s.label} showing EV edge ${s.evPct.toFixed(1)}%`,
            subtitle: `${g.event.away.name} @ ${g.event.home.name}`,
            gameId: g.event.id,
            market: m.market,
            confidence: s.confidence
          });
        }
      }
    }
  }
  return out.slice(0, 16);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const league = (url.searchParams.get("sport") || "nfl") as LeagueKey;
  const markets = url.searchParams.get("markets") || "h2h,spreads,totals";
  const regions = url.searchParams.get("regions") || "us";
  const sportKey = toSportKey(league);

  const cacheKey = `board|${league}|${markets}|${regions}`;
  const hit = cacheGet<BoardResponse>(cacheKey);
  if (hit) return NextResponse.json(hit, { headers: boardCacheHeaders() });

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing ODDS_API_KEY" }, { status: 500 });
  }

  const base = process.env.ODDS_API_BASE || DEFAULT_BASE;
  const upstream = new URL(`${base}/v4/sports/${sportKey}/odds`);
  upstream.searchParams.set("regions", regions);
  upstream.searchParams.set("markets", markets);
  upstream.searchParams.set("oddsFormat", "american");
  upstream.searchParams.set("apiKey", apiKey);

  const res = await fetch(upstream.toString(), { headers: { Accept: "application/json" } });
  const text = await res.text();
  if (!res.ok) {
    return NextResponse.json(
      { error: "Upstream error", status: res.status, body: text.slice(0, 500) },
      { status: 502 }
    );
  }

  const raw = JSON.parse(text);
  const normalized = normalizeOddsApiResponse({ league, raw });

  const { games, newMovementState } = deriveGames({ normalized, movementState });
  Object.assign(movementState.openByKey, newMovementState.openByKey);
  Object.assign(movementState.prevByKey, newMovementState.prevByKey);

  const now = Date.now();
  const upcoming = games
    .filter((g) => Date.parse(g.event.commenceTime) >= now)
    .sort((a, b) => Date.parse(a.event.commenceTime) - Date.parse(b.event.commenceTime));

  const comingUp = upcoming.slice(0, 3);
  const bestValueNow = [...games].sort((a, b) => topEv(b) - topEv(a)).slice(0, 6);

  const payload: BoardResponse = {
    league,
    updatedAt: new Date().toISOString(),
    editorNote: summarizeEditorNote(comingUp, bestValueNow),
    comingUp,
    bestValueNow,
    games,
    feed: buildFeed(games)
  };

  cacheSet(cacheKey, payload, 20_000);
  return NextResponse.json(payload, { headers: boardCacheHeaders() });
}
