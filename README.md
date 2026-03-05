# EmpirePicks (EmpireRevo)

OddsTrader-style line shopping grid powered by The Odds API, with a sharp-weighted no-vig fair line model.

## Features

- Server-only Odds API integration via Next.js route handlers
- Odds grid with league + market filters (`Moneyline`, `Spread`, `Total`)
- Weighted no-vig fair probability and fair American line
- Per-book edge display against fair consensus
- Fast board payloads with cache + CDN cache headers
- Health and status endpoints for environment diagnostics
- Optional Redis-backed cache and persisted line movement snapshots
- Optional API rate limiting via Upstash

## Environment Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create local env file:
   ```bash
   cp .env.example .env.local
   ```
3. Set required variable in `.env.local`:
   ```bash
   ODDS_API_KEY=your_key_here
   ```
4. Optional production-grade cache and rate limiting:
   ```bash
   UPSTASH_REDIS_REST_URL=...
   UPSTASH_REDIS_REST_TOKEN=...
   ```
4. Run locally:
   ```bash
   npm run dev
   ```

## Vercel Deployment

1. In Vercel Project Settings -> Environment Variables, set:
- `ODDS_API_KEY` (required)
- `ODDS_API_BASE` (optional, defaults to `https://api.the-odds-api.com`)
- `EDGE_CACHE_S_MAXAGE` (optional)
- `EDGE_CACHE_SWR` (optional)
- `UPSTASH_REDIS_REST_URL` (optional, enables Redis cache + persisted movement + rate limit)
- `UPSTASH_REDIS_REST_TOKEN` (optional)
2. Redeploy after env changes (required for runtime pickup).

## API Endpoints

- `GET /api/health`
  - Returns `{ ok: true, oddsApiConfigured: boolean, cacheProvider: "memory" | "redis" }`
- `GET /api/status`
  - Returns uptime + odds API reachability + cache provider diagnostics
- `GET /api/odds?sportKey=...&regions=us&markets=h2h,spreads,totals`
  - Returns normalized `EventOdds[]`
- `GET /api/fair?sportKey=...&market=h2h|spreads|totals&model=sharp|equal`
  - Returns fair-line enriched board used by the UI
- `GET /api/board?...`
  - Legacy board endpoint retained for compatibility

## Testing

Run unit tests (fair math + no-vig baseline):

```bash
npm test
```

## Notes

- The Odds API key is never exposed to browser requests.
- Memory cache is process-local; for production persistence use Upstash Redis.
- UI language intentionally uses “market-implied edge” and “consensus,” not guaranteed outcomes.
