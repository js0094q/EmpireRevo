# Pinned-Book Workflows (Phase 5)

Pinned books are now first-class workflow controls for execution speed.

## Core Behaviors

- Pinned books are ordered first in the board grid (then by tier: sharp, signal, mainstream, promo).
- Board supports pinned-focused sorts:
  - `Sort: Pinned-book edge`
  - `Sort: Pinned stale strength`
  - `Sort: Pinned actionable score`
- Filter supports executable-only mode:
  - `Bettable at pinned books`

## Actionable Pinned Edge Logic

Pinned actionability is determined by:
- edge threshold (`calibration.pinned.actionableEdgePct`)
- stale/timing execution context (stale actionable states or strong close-pressure timing)

This prevents ranking pinned opportunities that are technically available but not practically actionable.

## Global Best vs User-Actionable Best

EmpirePicks now distinguishes:
- global best line (across all books)
- pinned best line (books user can execute)

Top opportunity surfaces include explicit text when:
- the global best is available in pinned books
- pinned execution differs from abstract market best

## Why This Improves Pro Workflow

Serious users can quickly answer:
- what is best in my books right now?
- which pinned opportunities are decaying fastest?
- where does actionable pinned value diverge from board-wide value?

without leaving the main board workflow.
