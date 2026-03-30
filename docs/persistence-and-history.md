# Persistence and History

EmpirePicks persists its own normalized odds history from the live board pipeline. Historical storage is additive to the fair engine, not a separate subsystem.

## What Is Stored

Versioned JSON records:

- `empire:odds:snapshot:{sport}:{eventId}:{market}:{bucketTs}`
- `empire:odds:timeline:{sport}:{eventId}:{market}`
- `empire:odds:history:index:{sport}:{eventId}`
- `empire:odds:history:index:events`
- `empire:validation:event:{id}`
- `empire:validation:index:{dateBucket}`
- `empire:evaluation:closing:{sport}:{eventId}:{market}`
- `empire:diagnostics:factor:{dateBucket}`

## Canonical Snapshot Shape

Each persisted odds observation is captured at the book/outcome level with explicit fields:

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

Snapshots are written in event+market buckets, but the write model remains granular inside each bucket. The system does not store raw upstream blobs as the primary historical record.

## Snapshot and Timeline Rules

Snapshots are persisted from the actual normalized fair-board pass or from the internal collection path that reuses that same normalized fetch.

No extra upstream odds fetches are added solely for persistence.

Timeline construction is sparse and real:

- no interpolation
- no fake open points
- null-safe when history is limited
- derived from persisted observations, not transient request memory

## Write and Read Responsibilities

`snapshotPersistence.ts`:

- converts normalized fair-engine outcomes into persisted snapshot buckets
- writes snapshots in batches
- tracks per-batch write counts and failures
- keeps exact-write failures non-fatal

`historyStore.ts`:

- writes bucket records and timeline summaries
- loads ordered history for an event, market, or explicit history key
- exposes recent-event history summaries for diagnostics
- prunes by age using retention-based TTLs

`movement.ts`:

- consumes persisted timelines as the canonical source for movement, pressure, and value-timing signals
- no separate ad hoc movement tracker remains authoritative

## Durability and Fallback

`persistence.ts` uses:

- Redis (durable) when configured
- in-memory fallback otherwise

User-facing board flow continues even if persistence writes fail.
Internal diagnostics routes fail closed when durable persistence is unavailable.

## Collection Entry Points

Historical writes can come from either of these shared paths:

- normal board/event rendering through `oddsService.ts`
- internal collection through `app/api/internal/snapshots/collect/route.ts`

Both paths operate on normalized internal odds and write the same canonical snapshot model.

## Persistence Telemetry

`persistenceTelemetry.ts` tracks approximate health metrics:

- write attempts/success/fail
- fallback write activity
- average snapshot/validation payload bytes
- recent read/write failures
- namespaces touched
- rolling read latency estimates for timeline/validation reads

Telemetry is best-effort and bounded by diagnostics TTL.

## TTL Defaults

Snapshot retention is driven by `ODDS_SNAPSHOT_RETENTION_HOURS` and defaults to `72` hours.

From `persistenceConfig.ts`:

- snapshots: retention-window driven
- timelines: retention-window driven
- validation events: 60 days
- evaluations: 60 days
- diagnostics/telemetry: 1 day
