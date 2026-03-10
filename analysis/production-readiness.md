# Production Readiness Assessment

**Ready:** No  
**Not Ready Because:** Core odds APIs are broken, documentation is missing, and build/tests do not guarantee correctness.

## Build & CI Reliability
- Commands exist (`npm run lint`, `npm run typecheck`, `npm run build`) but lint still emits warnings (unoptimized `<img>` tags) and the fair board code relies on `// @ts-nocheck` to compile.
- Unit test coverage is negligible (only `fairMath` and `movement` are tested). There are no integration or UI tests, so regressions would go unnoticed.

## Error Handling & Validation
- `/api/fair` is currently mis-wired: `buildFairBoard` takes positional args but the route passes an object and never awaits the async function. The endpoint therefore cannot produce the documented schema, effectively taking the main dashboard offline.
- Request validation is ad-hoc per route; there is no schema enforcement, so malformed inputs can hit upstream services.
- Missing documentation (`docs/odds-math.md`) means there is no authoritative source to validate calculations against.

## Data Freshness & Caching
- Every endpoint independently calls The Odds API, so rate limits and latency remain a concern. In-memory caches are per-instance when Redis is absent.
- Movement tracking is duplicated (`movement.ts` vs `snapshots.ts`), risking inconsistent results between dashboards.

## UI Completeness
- `/` depends on `/api/fair`, so the primary experience is broken until the fair engine is repaired.
- `/games` demonstrates the desired line-shopping grid but lacks league/market controls and side toggles, so users cannot explore the broader market without visiting other routes.

## Critical Fixes Required
1. Restore `docs/odds-math.md` (or equivalent) and refactor `lib/server/odds/fairEngine.ts` + `/api/fair` so that the fair board actually works and is type-safe.
2. Eliminate server-to-server HTTP calls by invoking shared odds services directly from server components; otherwise cada page load doubles backend work.
3. Consolidate caching/movement logic and add automated tests for the end-to-end odds pipeline (fetch → normalize → fair price → EV → API).
4. Resolve lint warnings and remove `ts-nocheck` so CI can detect real regressions.
