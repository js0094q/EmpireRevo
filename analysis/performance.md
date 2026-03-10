# Performance & Reliability Findings

## Redundant External Calls
- `/api/board`, `/api/fair`, and `/api/odds` each call The Odds API independently (and `app/page.tsx` + `/game/[eventId]` call `/api/fair` again over HTTP). A single page load can therefore trigger *three* separate upstream requests, quickly exhausting rate limits. Consider sharing normalized data (e.g., fetch once, fan out to builders) or memoizing per sport/market window.

## Server-to-Server HTTP Calls
- `app/page.tsx` and `app/game/[eventId]/page.tsx` run on the server but still issue `fetch` requests to `/api/fair` (line 19). This adds latency, double JSON serialization, and makes observability harder. They should call the underlying functions (`fetchOddsFromUpstream`/`buildFairBoard`) directly.

## Cache Coverage Gaps
- When Upstash Redis is not configured, caching falls back to in-memory Maps (`lib/server/odds/cache.ts`). Any server restart flushes data, and caches are per-instance, so scaling horizontally multiplies upstream traffic. There is no protection against cache stampedes.
- The aggregator-specific cache (`lib/server/cache/oddsCache.ts`) only keys off sport/market/regions. It does not include query options like time windows, so adding such options later could lead to stale caching.

## Client Bundle Weight
- `app/ui-client.tsx` bundles everything (toolbar interactions, filters, feed cards, detail drawers, chart generation). Because the entire file is marked `\"use client\"` the whole board re-renders whenever any state changes. There is no virtualization or memoization around expensive computations (variance, chart series), so scrolling through dozens of games leads to slow frames.

## Movement Tracking Duplication
- Legacy `/api/fair` relies on `lib/server/odds/movement.ts` (rich history, window-based pruning) while the new aggregator uses `lib/server/odds/snapshots.ts` (just open/current delta). Maintaining two incompatible systems complicates caching and wastes memory; consolidating would reduce processing cost and produce consistent UI signals.

## Bundle / Asset Concerns
- No images are optimized via `next/image` (ESLint already warns). Large SVG/CSS assets are shipped regardless of route because globals import everything.
- There is no code-splitting between the main board and the editor drawer; all UI features load eagerly even if the user only wants a quick odds peek.

## Reliability Risks
- `/api/fair` is currently broken; every request is likely throwing at runtime, meaning the primary dashboard endpoint is essentially down.
- Lack of validation or retries around `fetchOddsFromUpstream` means a transient upstream 500 bubbles straight to the client as a failure, and the cache is not updated, causing repeated attempts that hammer the API.
