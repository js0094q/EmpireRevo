# Deployment Notes for Coding Agents

## Vercel Environment Variables

Never print or expose secrets.

Common odds-related env vars:

```bash
ODDS_API_KEY=
ODDS_API_BASE=https://api.the-odds-api.com
ODDS_API_ALLOWED_HOSTS=api.the-odds-api.com
ODDS_ALLOWED_SPORT_KEYS=
NEXT_PUBLIC_DEFAULT_LEAGUE=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
EMPIRE_INTERNAL_API_KEY=
```

## FIFA World Cup

If production uses `ODDS_ALLOWED_SPORT_KEYS`, append:

```text
soccer_fifa_world_cup
```

Example:

```bash
ODDS_ALLOWED_SPORT_KEYS=americanfootball_nfl,basketball_nba,baseball_mlb,soccer_fifa_world_cup
```

Do not remove existing enabled sport keys.

## Deployment Handoff

If a change requires Vercel env updates, state it explicitly.

If no deploy was performed, say:

```text
I did not deploy, push, or commit.
```

## Security Rules

- Do not commit `.env*`.
- Do not log API keys.
- Do not expose internal diagnostics without auth.
- Keep `/api/internal/*` and `/internal/*` protected.
