# Visual Regression

This suite captures desktop and mobile snapshots for the serious-workstation
surface:

- Populated board (`/?league=nba&market=h2h&model=weighted`)
- Filter-empty board (`/?league=nba&market=h2h&model=weighted&search=__visual_no_match__`)
- Route-level empty-feed board (`/?league=mlb&market=h2h&model=weighted`)
- Upstream-error board (`/?league=nhl&market=h2h&model=weighted` on desktop,
  `/?league=nfl&market=h2h&model=weighted` on mobile)
- Stale-inclusive board (`/?league=ncaab&market=h2h&model=weighted&stale=1`)
- Games list (`/games?league=nba&market=h2h&model=weighted`)
- Game detail (`/game/[eventId]?league=nba&market=h2h&model=weighted`)
- Game detail not-found (`/game/not-current-event?league=nba&market=h2h&model=weighted`)
- Game detail upstream-error (`/game/error-event?league=nfl&market=h2h&model=weighted`)
- Authenticated internal engine with Redis-backed diagnostics (`/internal/engine`)
- Locked internal engine (`/internal/engine` without the internal session cookie)

The runner starts local mock odds and Redis APIs, boots the Next.js app against
those APIs, freezes visual time, verifies expected route text/status, and
compares screenshots against committed baselines. The odds mock returns NBA data
for live board/game routes, NCAAB stale data for stale coverage, NHL/NFL
rate-limit responses for error coverage, and an empty MLB payload for
route-level empty-feed coverage. The Redis mock supports Upstash-style pipelined
commands and seeds validation, evaluation, outcome, history, and telemetry data
so authenticated internal coverage exercises the durable diagnostics view rather
than the degraded persistence-unavailable branch.

An optional external Redis smoke run can verify the same authenticated internal
diagnostics path against a real Upstash Redis REST database. It requires
`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in the shell or local
env files. It also accepts a gitignored `.redis.local` file that uses Vercel
KV-style `KV_REST_API_URL` and `KV_REST_API_TOKEN` names. The smoke run seeds a
small diagnostics fixture, captures current screenshots, and restores the
touched keys after the run. It does not update or compare committed baselines.

## Commands

```bash
npm run test:visual
```

Run the real Upstash Redis smoke check:

```bash
npm run test:visual:redis
```

Update or create baselines:

```bash
npm run test:visual -- --update
```

## Output folders

- `tests/visual/baseline/` committed baseline snapshots
- `tests/visual/current/` latest run snapshots (gitignored)
- `tests/visual/diff/` diff images for failing comparisons (gitignored)
