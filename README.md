# EmpirePicks (EmpireRevo)

OddsTrader-style line shopping grid powered by The Odds API, with a sharp-weighted no-vig fair line model.

## Features

- Server-only Odds API integration via Next.js route handlers
- Odds grid with league + market filters (`Moneyline`, `Spread`, `Total`)
- Weighted no-vig fair probability and fair American line
- Per-book edge display against fair consensus
- Fast board payloads with server cache + CDN cache headers
- Health check endpoint for environment diagnostics

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
2. Redeploy after env changes (required for runtime pickup).

## API Endpoints

- `GET /api/health`
  - Returns `{ ok: true, oddsApiConfigured: boolean }`
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
- In-memory cache is process-local and resets per runtime instance restart.
- UI language intentionally uses “market-implied edge” and “consensus,” not guaranteed outcomes.
