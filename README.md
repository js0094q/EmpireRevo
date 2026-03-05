# EmpireRevo (EmpirePicks)

Real-time sportsbook market board built with Next.js.

## Features

- Aggregates odds from The Odds API
- Normalizes bookmaker data into a consistent schema
- Computes weighted consensus, EV %, and movement signals
- Serves a board API and live UI for upcoming and best-value games

## Tech Stack

- Next.js 15 (App Router)
- React 19
- TypeScript

## Project Structure

- `app/`: routes, API handlers, and top-level UI
- `lib/odds/`: odds normalization, weighting, derivation, and cache helpers
- `lib/ui/`: presentational components
- `docs/`: supporting documentation

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env template and add your API key:
   ```bash
   cp .env.example .env.local
   ```
3. Run locally:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000`

## Environment Variables

- `ODDS_API_KEY` (required)
- `ODDS_API_BASE` (optional)
- `EDGE_CACHE_S_MAXAGE` (optional)
- `EDGE_CACHE_SWR` (optional)

## API Endpoints

- `GET /api/board?sport=nfl|nba|nhl|ncaab|mlb`
- `GET /api/odds?sportKey=...&regions=us&markets=h2h,spreads,totals`

## Notes

- In-memory cache is process-local and resets on restart.
- `docs/managed-configuration.md` contains Codex managed config reference material.
