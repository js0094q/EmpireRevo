# Repository Architecture

## Framework & Language
- **Framework:** Next.js 16 (App Router) with hybrid server/client rendering.
- **Language:** TypeScript across server, client, and tests.
- **UI runtime:** React 19 function components, heavy client hook usage in `app/ui-client.tsx`.
- **Server runtime:** Node.js (all API routes export `runtime = "nodejs"`).
- **Build system:** `next build`/Turbopack plus `tsc --noEmit` for type-checking.
- **Testing harness:** `tsx --test` (see `tests/*.test.ts`).

## Dependency Stack
- `next`, `react`, `react-dom` for the web framework.
- `@upstash/redis` and `@upstash/ratelimit` for caching and middleware rate limiting (`proxy.ts`).
- Tooling: `typescript`, `eslint`/`eslint-config-next`, `tsx` test runner.
- No UI component library; styling handled manually via `app/globals.css`.

## Major Directories
- `app/` – App Router tree: pages (`page.tsx`, `game/[eventId]/page.tsx`, `games/page.tsx`), layout, global styles, and the large `ui-client.tsx` client bundle.
- `app/api/` – Next.js Route Handlers (`board`, `fair`, `odds`, `health`, `status`).
- `lib/server/odds/` – All odds domain services: external client, normalization, math engines, aggregation, caching, movement tracking, env helpers, Redis bindings, etc.
- `lib/odds/` – Shared schema/types (`schemas.ts`).
- `tests/` – Minimal unit tests for `fairMath` and `movement` utilities.
- `scripts/` – Misc tooling (e.g., doc/test helpers; not actively referenced in task).
- `docs/` – Currently empty aside from `.DS_Store`; expected specs (e.g., `odds-math.md`) are missing.

## Key Modules
- **Odds ingestion:** `lib/server/odds/client.ts` hits The Odds API via fetch; `normalize.ts` maps raw payloads into internal `NormalizedEventOdds`.
- **Math utilities:** `lib/server/odds/fairMath.ts`, `ev.ts`, `bestLine.ts`, `weights.ts` define conversions, vig removal, probability weighting, EV, and book weights.
- **Aggregation engines:** `lib/server/odds/aggregator.ts` (new sportsbook grid), `lib/server/odds/derive.ts` (legacy board builder), `lib/server/odds/fairEngine.ts` (out-of-date fair board implementation, now under `ts-nocheck`).
- **State/caching:** `lib/server/odds/cache.ts`, `redis.ts`, `snapshots.ts`, `movement.ts` provide TTL caches and price history tracking.
- **API layer:** `app/api/board/route.ts`, `app/api/fair/route.ts`, `app/api/odds/route.ts`, `app/api/health/route.ts`, `app/api/status/route.ts` orchestrate ingestion → normalization → response.
- **UI:** `app/ui-client.tsx` renders the primary odds grid and editor note; `app/games/page.tsx` renders the new OddsTrader-style table; `app/game/[eventId]/page.tsx` displays drill-down details.
- **Middleware:** `proxy.ts` enforces Upstash-backed rate limiting on `/api/*` routes.
