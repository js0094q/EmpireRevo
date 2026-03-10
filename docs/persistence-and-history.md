# Persistence and History (Phase 6.1)

Phase 6.1 preserves the Phase 6 single pipeline and adds persistence telemetry for operational visibility.

## What Is Stored

Versioned JSON records:

- `empire:odds:snapshot:{sport}:{eventId}:{market}:{bucketTs}`
- `empire:odds:timeline:{sport}:{eventId}:{market}`
- `empire:validation:event:{id}`
- `empire:validation:index:{dateBucket}`
- `empire:evaluation:closing:{sport}:{eventId}:{market}`
- `empire:diagnostics:factor:{dateBucket}`

## Snapshot and Timeline Rules

Snapshots are persisted from the actual fair-board scoring pass.
No extra upstream odds fetches are added for persistence.

Timeline construction is sparse and real:

- no interpolation
- no fake open points
- null-safe when history is limited

## Durability and Fallback

`persistence.ts` uses:

- Redis (durable) when configured
- in-memory fallback otherwise

User-facing board flow continues even if persistence writes fail.
Internal diagnostics routes fail closed when durable persistence is unavailable.

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

From `persistenceConfig.ts`:

- snapshots: 10 days
- timelines: 21 days
- validation events: 60 days
- evaluations: 60 days
- diagnostics/telemetry: 1 day
