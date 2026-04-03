import type { EventRef, LeagueKey, MarketKey, NormalizedEventOdds, TeamRef } from "@/lib/odds/schemas";
import type { EventOdds } from "@/lib/server/odds/types";
import { TEAM_LOGO_MAP, canonicalizeTeamName, resolveTeamLogo, type TeamLogoMap } from "@/lib/server/odds/logos";
import { getBookRef } from "@/lib/server/odds/weights";

function slugify(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function eventId(league: LeagueKey, away: string, home: string, commenceTime: string): string {
  return `${league}_${slugify(away)}_at_${slugify(home)}_${commenceTime}`;
}

function deriveEventStatus(rawEvent: any, commenceTime: string, nowMs: number): EventRef["status"] {
  const statusRaw = String(rawEvent?.status || rawEvent?.state || "").trim().toLowerCase();
  if (
    rawEvent?.completed === true ||
    rawEvent?.is_completed === true ||
    statusRaw === "final" ||
    statusRaw === "closed" ||
    statusRaw === "complete" ||
    statusRaw === "completed"
  ) {
    return "final";
  }

  if (rawEvent?.in_progress === true || rawEvent?.live === true || statusRaw === "in_progress" || statusRaw === "live") {
    return "live";
  }

  const commenceTs = Date.parse(commenceTime);
  if (Number.isFinite(commenceTs) && commenceTs <= nowMs) {
    return "live";
  }

  return "upcoming";
}

export function normalizeOddsApiResponse(params: {
  league: LeagueKey;
  raw: any[];
  teamLogoMap?: TeamLogoMap;
}): NormalizedEventOdds[] {
  const { league, raw } = params;
  const teamLogoMap = params.teamLogoMap || TEAM_LOGO_MAP;
  const fetchedAt = new Date().toISOString();
  const nowMs = Date.now();

  return raw.map((event: any) => {
    const homeName = String(event.home_team || "Home");
    const awayName = String(event.away_team || "Away");
    const canonicalHomeName = canonicalizeTeamName(homeName, league);
    const canonicalAwayName = canonicalizeTeamName(awayName, league);

    const home: TeamRef = {
      id: slugify(canonicalHomeName),
      name: homeName,
      logoUrl: resolveTeamLogo(homeName, league, teamLogoMap)
    };

    const away: TeamRef = {
      id: slugify(canonicalAwayName),
      name: awayName,
      logoUrl: resolveTeamLogo(awayName, league, teamLogoMap)
    };

    const eventRef: EventRef = {
      id: eventId(league, awayName, homeName, String(event.commence_time || "")),
      league,
      commenceTime: String(event.commence_time || ""),
      home,
      away,
      status: deriveEventStatus(event, String(event.commence_time || ""), nowMs)
    };

    const books = (event.bookmakers || []).map((bookmaker: any) => ({
      book: getBookRef(String(bookmaker.key || "unknown"), String(bookmaker.title || "Unknown")),
      markets: (bookmaker.markets || []).map((market: any) => ({
        market: String(market.key || "h2h") as MarketKey,
        lastUpdate: String(market.last_update || fetchedAt),
        outcomes: (market.outcomes || []).map((outcome: any) => ({
          name: String(outcome.name || ""),
          price: Number(outcome.price || 0),
          point: outcome.point === undefined ? undefined : Number(outcome.point)
        }))
      }))
    }));

    return {
      event: eventRef,
      books,
      fetchedAt
    };
  });
}

export function toEventOddsList(params: { normalized: NormalizedEventOdds[]; sportKey: string }): EventOdds[] {
  const { normalized, sportKey } = params;
  return normalized.map((event) => ({
    id: event.event.id,
    commenceTime: event.event.commenceTime,
    homeTeam: event.event.home.name,
    awayTeam: event.event.away.name,
    homeLogoUrl: event.event.home.logoUrl,
    awayLogoUrl: event.event.away.logoUrl,
    sportKey,
    books: event.books.map((book) => ({
      bookKey: book.book.key,
      title: book.book.title,
      lastUpdate: book.markets
        .map((market) => market.lastUpdate)
        .filter(Boolean)
        .sort()
        .pop(),
      markets: book.markets.map((market) => ({
        key: market.market,
        lastUpdate: market.lastUpdate,
        outcomes: market.outcomes.map((outcome) => ({
          name: outcome.name,
          priceAmerican: outcome.price,
          point: outcome.point
        }))
      }))
    }))
  }));
}
