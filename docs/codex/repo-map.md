# EmpirePicks Repo Map

Purpose: reduce repeated discovery work for coding agents.

## Core Stack

- Next.js App Router
- React
- TypeScript strict mode
- Node >= 20
- Vercel deployment
- Optional Upstash Redis persistence/cache

## High-Value Paths

| Path | Purpose |
|---|---|
| `app/` | App Router pages and route groups |
| `app/api/board/route.ts` | Public board API |
| `app/api/fair/route.ts` | Fair odds / EV API |
| `app/api/odds/route.ts` | Odds API wrapper, including raw/internal handling |
| `app/api/internal/snapshots/collect/route.ts` | Internal snapshot collection |
| `app/games/` | Games route / redirect behavior if present |
| `lib/server/odds/` | Core server-side odds logic |
| `lib/server/odds/aggregator.ts` | Fair odds aggregation / EV pipeline if present |
| `lib/server/odds/client.ts` | Odds provider fetch client |
| `lib/server/odds/env.ts` | Odds API env parsing and upstream allowlist |
| `lib/server/odds/requestValidation.ts` | Query validation and allowed sport/market parsing |
| `lib/server/odds/calibration.ts` | Ranking/confidence calibration |
| `lib/server/odds/cache.ts` | Cache behavior |
| `lib/server/odds/historyStore.ts` | Historical odds timelines |
| `lib/server/odds/snapshotPersistence.ts` | Snapshot persistence |
| `lib/server/odds/validationEvents.ts` | Validation/outcome events |
| `scripts/visual-regression.ts` | Visual regression workflow |
| `tests/` | Unit/integration tests |

## Do Not Casually Modify

- Odds math
- Vig removal
- Book weighting
- EV formulas
- API response schemas
- Internal auth
- Provider key handling
- Environment secret handling

Any change to EV math must be explicitly justified in comments and tests.
