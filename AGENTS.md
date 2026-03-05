# AGENTS.md (Codex / Agent Operating Guide)

## Project goal
EmpirePicks is a line-shopping and market-consensus web app (OddsTrader-style grid) powered by The Odds API.
Key differentiator: weighted no-vig "fair line" and book-level edge display.

## Ground rules
1. Never expose `ODDS_API_KEY` to the client.
   - All Odds API calls must happen in Next.js route handlers under `/app/api/*`.
   - UI calls our own endpoints only.
2. Do not ship breaking UI states.
   - If `ODDS_API_KEY` is missing or returns 401, show a "Configuration Required" screen and stop polling.
3. Performance matters.
   - Add caching at the server route layer (revalidate or short TTL in-memory).
   - Avoid re-render storms on the board grid.
4. UI must be clean and readable.
   - Mobile-first
   - Sticky matchup column on desktop
   - Highlight best price, show fair line, show edge badge

## Commands
- Install: `npm ci`
- Dev: `npm run dev`
- Build: `npm run build`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Test: `npm test`

## Environment
Required:
- `ODDS_API_KEY` (server-only)

Optional:
- `NEXT_PUBLIC_DEFAULT_LEAGUE` (client, safe)

## Data contracts
### Internal normalized types
Maintain stable internal types for:
- `EventOdds`, `BookOdds`, `Market`, `Outcome`

### Fair line engine
Implement:
- American -> implied prob
- De-vig per book (proportional for 2-way markets)
- Weighted consensus by book weight map
- Fair prob -> fair American odds
- Edge as bookProbNoVig - fairProb (or vice versa), label explicitly

## Book weighting
Maintain a single source of truth:
- `/lib/server/odds/fairEngine.ts`
- Must map Odds API book keys to weights
- Provide a default weight for unknown books

## API endpoints (server)
- `GET /api/health`: returns `{ ok, oddsApiConfigured }`
- `GET /api/odds?sportKey=...&markets=...`: raw normalized events
- `GET /api/fair?sportKey=...&market=...`: enriched with fair line and edges

All endpoints must:
- handle missing key gracefully
- return stable errors (JSON), never throw raw exceptions to the client
- cache for 20-60 seconds

## UX requirements
- League selector, market tabs (ML / Spread / Total), date window (Next 24h)
- Odds grid:
  - rows = events
  - columns = books + "Fair"
  - best price highlights per side
  - edge badges (thresholded, configurable)

## Do not do
- Do not call The Odds API from browser code.
- Do not add heavy UI libraries that bloat bundle size unless justified.
- Do not break routing or existing components without updating imports and tests.

## PR hygiene
- Keep changes small and atomic.
- Add or update tests for fair line math where feasible.
- Update README when env vars or deployment steps change.
