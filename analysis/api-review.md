# API Layer Review

## Overview
All routes live under `app/api/*` and declare `runtime = "nodejs"`. Middleware `proxy.ts` applies an optional Upstash-backed rate limit to every `/api/*` request. Each handler uses shared utilities from `lib/server/odds/` (client, cache, normalization, etc.).

## Endpoints
| Endpoint | Handler | Request Parameters | External Dependencies | Notes |
| --- | --- | --- | --- | --- |
| `GET /api/board` | `app/api/board/route.ts` | `sport` (league key), `regions`, `markets` | `fetchOddsFromUpstream` → The Odds API (`/v4/sports/{sportKey}/odds`) | Normalizes all markets, runs `deriveGames`, computes editor notes/feed, caches for 20 s, returns `BoardResponse`. Error handling distinguishes missing key vs upstream failure. |
| `GET /api/fair` | `app/api/fair/route.ts` | `sportKey`, `market`, `model`, `regions`, `minBooks`, `windowHours`, `historyWindowHours`, optional `books` filter | Same Odds API call (always requests `h2h,spreads,totals`) | Intended to build the “fair board” plus per-book movement history. **Bug:** `buildFairBoard` has a different signature (takes positional args) and the handler never awaits the async function, so `payload` is a Promise. `ts-nocheck` hides the type errors, but at runtime `payload.events` is undefined — meaning `/api/fair` cannot respond with meaningful data. |
| `GET /api/odds` | `app/api/odds/route.ts` | `sportKey`, `regions`, `market`/`markets`, `oddsFormat`, optional `format=raw` | Same Odds API call, but scoped to a single market | Wraps the new `getAggregatedOdds` service (30 s cache). Returns aggregated `games` summary or raw normalized events when `format=raw`. Error handling mirrors other routes. |
| `GET /api/health` | `app/api/health/route.ts` | none | none | Returns `{ok, oddsApiConfigured, cacheProvider}` by checking env + cache status. |
| `GET /api/status` | `app/api/status/route.ts` | none | Direct fetch to `https://api.the-odds-api.com/v4/sports` to confirm API reachability; uses same Upstash Redis info | Returns uptime, odds API health, and cache status. Timeouts after 3 s but doesn’t surface detailed errors. |

## Error Handling & Validation
- Shared pattern: `fetchOddsFromUpstream` throws with `code = "MISSING_KEY"` or `code = "UPSTREAM_ERROR"`. Every route catches these and returns JSON error responses with 500/502.
- Parameter parsing is minimal: `/api/fair` enforces bounded ints for book counts, `/api/board` only normalizes league names, `/api/odds` sanitizes markets to `h2h` by default. There is no schema validation beyond manual guards.
- Missing safeguards: `/api/odds` exposes `format=raw` but doesn’t cap payload size or enforce authentication. `/api/fair` accepts `books` string but never validates that requested books exist, and because the core engine is broken the downstream UI cannot function.

## External API Usage
- All odds data ultimately comes from The Odds API using `fetch` with query parameters built from route inputs.
- Redis/Upstash is optional; when not configured, caching drops back to in-memory maps. This means server restarts clear caches and rate limiting is disabled.

## Conclusions
- The API surface is conceptually rich but `/api/fair` (the most important route for the main dashboard) is non-functional due to the stale `buildFairBoard` implementation. Until that bug is addressed, the homepage and detail pages cannot serve real data.
- There is significant duplication: every odds endpoint independently calls The Odds API rather than sharing normalized data, increasing latency and the risk of hitting upstream rate limits.
- Input validation is ad-hoc and should be consolidated (e.g., with Zod or custom guards) to avoid malformed requests reaching the Odds API.
