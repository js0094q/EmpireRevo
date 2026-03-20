import type { EventRef } from "@/lib/odds/schemas";
import type { FairEvent } from "@/lib/server/odds/types";

type EventRouteFields = {
  id?: string;
  baseEventId?: string;
  sportKey?: string;
  league?: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
};

type BasicEventRouteSource = {
  id?: string;
  baseEventId?: string;
  sportKey?: string;
  league?: string;
  commenceTime: string;
  homeTeam: string;
  awayTeam: string;
};

export type EventRouteSource =
  | BasicEventRouteSource
  | Pick<FairEvent, "id" | "baseEventId" | "sportKey" | "commenceTime" | "homeTeam" | "awayTeam">
  | Pick<EventRef, "id" | "league" | "commenceTime" | "home" | "away">
  | { event: Pick<EventRef, "id" | "league" | "commenceTime" | "home" | "away">; sportKey?: string };

function decodeRouteId(routeId: string): string {
  try {
    return decodeURIComponent(routeId);
  } catch {
    return routeId;
  }
}

function normalizeRouteId(routeId: string): string {
  return decodeRouteId(routeId).trim().toLowerCase();
}

function normalizeCommenceTime(value: string): string {
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) {
    return normalizeSlugPart(value) || "unknown-time";
  }

  return new Date(ts)
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .toLowerCase()
    .replace(/:/g, "-");
}

function extractFields(event: EventRouteSource): EventRouteFields {
  if ("event" in event) {
    return {
      id: event.event.id,
      sportKey: event.sportKey,
      league: event.event.league,
      commenceTime: event.event.commenceTime,
      homeTeam: event.event.home.name,
      awayTeam: event.event.away.name
    };
  }

  if ("homeTeam" in event && "awayTeam" in event) {
    return {
      id: event.id,
      baseEventId: event.baseEventId,
      sportKey: event.sportKey,
      commenceTime: event.commenceTime,
      homeTeam: event.homeTeam,
      awayTeam: event.awayTeam
    };
  }

  return {
    id: event.id,
    league: event.league,
    commenceTime: event.commenceTime,
    homeTeam: event.home.name,
    awayTeam: event.away.name
  };
}

function sportRoutePart(fields: EventRouteFields): string {
  if (fields.league) {
    const league = normalizeSlugPart(fields.league);
    if (league) return league;
  }

  if (fields.sportKey) {
    const normalizedSportKey = normalizeSlugPart(fields.sportKey);
    if (!normalizedSportKey) return "sport";
    const parts = normalizedSportKey.split("-");
    const tail = parts[parts.length - 1];
    return tail || normalizedSportKey;
  }

  return "sport";
}

function legacyIdsForEvent(fields: EventRouteFields): string[] {
  const raw = [fields.id, fields.baseEventId].filter((value): value is string => Boolean(value && value.trim().length));
  const ids = new Set<string>();
  for (const value of raw) {
    ids.add(value);
    const base = value.split(":")[0];
    if (base) ids.add(base);
  }
  return Array.from(ids);
}

export function normalizeSlugPart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function toEventRouteId(event: EventRouteSource): string {
  const fields = extractFields(event);
  const sport = sportRoutePart(fields);
  const away = normalizeSlugPart(fields.awayTeam) || "away";
  const home = normalizeSlugPart(fields.homeTeam) || "home";
  const commenceTime = normalizeCommenceTime(fields.commenceTime);
  return `${sport}_${away}_at_${home}_${commenceTime}`;
}

export function matchesEventRouteId(event: EventRouteSource, routeId: string): boolean {
  const normalizedRequestedRouteId = normalizeRouteId(routeId);
  if (!normalizedRequestedRouteId) return false;

  if (toEventRouteId(event) === normalizedRequestedRouteId) {
    return true;
  }

  const fields = extractFields(event);
  const legacyIds = legacyIdsForEvent(fields);
  return legacyIds.some((legacyId) => normalizeRouteId(legacyId) === normalizedRequestedRouteId);
}
