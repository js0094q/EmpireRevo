# Historical Odds Collection

EmpirePicks collects historical odds by persisting its own normalized live snapshots. It does not depend on a third-party historical odds endpoint.

## Design Rules

- history is captured after normalization, not from raw upstream payloads
- history uses the same internal event/market/outcome/book vocabulary as the fair engine
- the shared fetch path powers both board rendering and snapshot collection
- persistence is additive and non-fatal; the board still renders when writes fail

## Canonical Flow

Shared request path:

1. `client.ts` fetches live odds from the upstream provider
2. `normalize.ts` converts the payload into stable internal event/book/market shapes
3. `fairEngine.ts` builds market groups and fair-price context
4. `snapshotPersistence.ts` converts normalized outcomes into granular persisted snapshots
5. `historyStore.ts` writes snapshot buckets, timelines, and history indexes
6. `movement.ts` derives movement, pressure, staleness, and value-timing signals from persisted history

Collection path:

1. `collectHistoricalSnapshots()` calls `getNormalizedOdds()`
2. per-market fair events are built from that normalized result
3. snapshots are written in batches using `ODDS_SNAPSHOT_BATCH_SIZE`
4. the route returns a compact operational summary

This preserves the single normalized pipeline and avoids an extra upstream odds request just to collect history.

## Persisted Snapshot Model

Each stored observation is granular enough to reconstruct book-level market history:

- `eventId`
- `sportKey`
- `marketKey`
- `outcomeKey`
- `outcomeLabel`
- `bookmakerKey`
- `bookmakerTitle`
- `priceAmerican`
- `point`
- `impliedProbability`
- `observedAt`

Snapshots are stored inside time buckets keyed by event and market. Timelines and read APIs are derived from those persisted observations, not from transient route memory.

## Collection Route

Internal trigger:

- `GET /api/internal/snapshots/collect`
- `POST /api/internal/snapshots/collect`

Runtime:

- `runtime = "nodejs"`

Auth:

- set `EMPIRE_INTERNAL_API_KEY`
- send `x-empire-internal-key: <value>`

Parameters:

- `sportKey`, default `basketball_nba`
- `regions`, default `us`
- `markets`, default `h2h,spreads,totals`
- `force=1` or `force=true` to bypass `ODDS_SNAPSHOT_COLLECTION_ENABLED=false`

Success response fields:

- `eventsProcessed`
- `snapshotsWritten`
- `failures`
- `durationMs`
- `fallbackMode`
- `durable`
- `configuredIntervalSeconds`

Behavior rules:

- duplicate runs are survivable because writes are bucketed and exact duplicate observations are tolerated
- partial write failure returns a success payload with non-zero `failures`
- when collection is disabled and `force` is absent, the route returns `409 SNAPSHOT_COLLECTION_DISABLED`

## Scheduling

Recommended cadence is every `60` seconds, but cadence is environment-configurable:

- `ODDS_SNAPSHOT_COLLECTION_ENABLED`
- `ODDS_SNAPSHOT_INTERVAL_SECONDS`
- `ODDS_SNAPSHOT_RETENTION_HOURS`
- `ODDS_SNAPSHOT_BATCH_SIZE`

Signal windows:

- `ODDS_HISTORY_SHORT_WINDOW_MINUTES`
- `ODDS_HISTORY_LONG_WINDOW_MINUTES`
- `ODDS_VALUE_PERSISTENCE_THRESHOLD_PCT`

The route is safe for Vercel Cron, an external scheduler, or an operator-triggered internal call.

## Failure Semantics

- Redis configured: snapshots are durable and shared across instances
- Redis unavailable or not configured: memory fallback remains available
- persistence failure never blocks board rendering
- diagnostics surfaces expose fallback mode, write health, and movement coverage so operators can detect degraded collection
