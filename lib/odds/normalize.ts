import type { LeagueKey, MarketKey, NormalizedEventOdds, TeamRef, EventRef } from "./schemas";
import { getBookRef } from "./bookWeights";

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function eventId(league: LeagueKey, away: string, home: string, iso: string): string {
  return `${league}_${slugify(away)}_at_${slugify(home)}_${iso}`;
}

export function normalizeOddsApiResponse(params: {
  league: LeagueKey;
  raw: any[];
  teamLogoMap?: Record<string, string>;
}): NormalizedEventOdds[] {
  const { league, raw, teamLogoMap } = params;
  const fetchedAt = new Date().toISOString();

  return raw.map((ev: any) => {
    const homeName = ev.home_team;
    const awayName = ev.away_team;

    const home: TeamRef = { id: slugify(homeName), name: homeName, logoUrl: teamLogoMap?.[homeName] };
    const away: TeamRef = { id: slugify(awayName), name: awayName, logoUrl: teamLogoMap?.[awayName] };

    const event: EventRef = {
      id: eventId(league, awayName, homeName, ev.commence_time),
      league,
      commenceTime: ev.commence_time,
      home,
      away,
      status: "upcoming"
    };

    const books = (ev.bookmakers || []).map((bm: any) => {
      const book = getBookRef(bm.key, bm.title);
      const markets = (bm.markets || []).map((m: any) => ({
        market: m.key as MarketKey,
        lastUpdate: m.last_update,
        outcomes: (m.outcomes || []).map((o: any) => ({
          name: o.name,
          price: o.price,
          point: o.point
        }))
      }));

      return { book, markets };
    });

    return { event, books, fetchedAt };
  });
}
