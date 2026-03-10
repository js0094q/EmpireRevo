# Suggested Improvements

## Critical
1. **Repair `/api/fair` + `buildFairBoard`:** Align the function signature with the route call, remove `ts-nocheck`, and ensure the handler actually returns `FairBoardResponse` so the main dashboard works again.
2. **Restore odds math spec:** Recreate `docs/odds-math.md` (or equivalent) and document every conversion/vig/EV formula so the math can be audited and unit-tested.
3. **Add integration tests for the odds pipeline:** Cover fetch → normalize → fair price → EV → API response to catch regressions before deployment.

## High
1. **Eliminate redundant upstream calls:** Share normalized odds between `/api/board`, `/api/fair`, `/api/odds`, and the server components instead of performing multiple HTTP round-trips per page load.
2. **Consolidate movement tracking:** Pick one mechanism (likely the richer `movement.ts`) and remove the lightweight `snapshots.ts` so all dashboards show identical movement data.
3. **Enhance `/games` UI controls:** Add league/market selectors, per-side toggles, and point display for spreads/totals to make the OddsTrader grid truly comparable.
4. **Introduce request validation:** Use a schema (Zod/Valibot) to validate query parameters before hitting The Odds API.

## Medium
1. **Modularize `app/ui-client.tsx`:** Break the monolith into smaller client components, add memoization, and consider table virtualization to keep renders fast.
2. **Move server components off HTTP fetches:** Call shared odds functions directly from `app/page.tsx`/`app/game/...` to reduce latency and simplify error logging.
3. **Improve docs & onboarding:** Fill in `README.md` with setup instructions, environment variables, and architecture notes.

## Low
1. **Resolve lint warnings:** Replace raw `<img>` tags with `next/image` or an optimized loader to improve LCP and satisfy ESLint.
2. **Refine CSS organization:** Split `globals.css` into scoped modules or adopt a utility framework to make future styling changes safer.
3. **Expose system health in the UI:** Surface `/api/status` and `/api/health` data somewhere in the dashboard so operators can see connectivity issues without checking logs.
