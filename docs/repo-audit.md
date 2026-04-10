# EmpirePicks Repo Audit

## Current state before overhaul

- `/` and `/games` shared the same board shell and did not communicate distinct product intent.
- The public board mixed hero framing, KPI summaries, filters, and table rendering in one client component.
- Public board rows were derived from reduced drilldown rows that dropped stale, pinned, timing, and suppression context already available in the backend.
- `app/game/[eventId]/page.tsx` combined routing, data loading, snapshot persistence, timeline assembly, and presentation.
- The public visual system used gradients, card framing, and pill density that did not match a disciplined workstation UI.
- Internal auth boundaries were already solid and fail-closed.
- Validation, odds math, ranking, and security coverage were already strong.

## Key changes implemented

- Public IA is now split into `Board`, `Games`, `Game Detail`, and protected `Internal`.
- Public rendering now runs through shared formatters and view models under `lib/ui`.
- Public board UI is table-first and compact, with URL-synced filters and browser-local preferences.
- `Game Detail` no longer persists snapshots during page render.
- Internal diagnostics are rendered through a dedicated operator view.
- Visual regression coverage now targets `home`, `games`, `game`, `empty`, and `internal`.

## Remaining follow-up candidates

- Remove or archive more of the legacy board components once the new surface settles.
- Add richer browser-level component tests if a React DOM test harness is introduced.
- Expand internal visual coverage beyond the persistence-unavailable operator state once a durable local persistence fixture exists.
