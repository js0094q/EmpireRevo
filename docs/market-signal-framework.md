# Market Signal Framework

## Signal Priority

Phase 5 keeps the Pro grid-first hierarchy and upgrades signal compression:
1. matchup / market context
2. best executable line
3. weighted fair line
4. edge + EV reliability state
5. confidence + stale integrity
6. timing / decay urgency
7. supporting movement + participation detail

## Opportunity Decay Logic

Timing labels are derived from stale strength, confidence, movement quality, holdout structure, and freshness:
- `Likely closing`
- `Single-book holdout`
- `Market converging`
- `Stable for now`
- `Weak timing signal`

These labels indicate urgency class, not precise expiry.

## Book Responsiveness Concepts

Board now provides lightweight per-book behavior summaries:
- lag rate
- stale signal rate
- disagreement rate
- move-first rate
- sample confidence level

Sparse samples are explicitly labeled as low-confidence behavior signals.

## Stale Opportunity Identification

A stale signal still requires multiple aligned conditions:
- edge support
- age / movement divergence
- consensus gap
- confidence-aware gating

`off_market` remains the conservative bucket for noisy, low-confidence outliers.

## Movement Timing Interpretation

Movement summaries are now derived from persisted time-series snapshots and expose:

- opening price and current price
- opening point and current point when applicable
- absolute price and point deltas
- number of observed changes
- short-window and long-window velocity
- first seen, last seen, and staleness context

## Historical Pressure Labels

Historical timelines support one deterministic pressure label per market:

- `sharp-up`
- `sharp-down`
- `broad-consensus`
- `fragmented`
- `stale`
- `none`

These labels describe observed sequencing and divergence from actual timestamps. They are not predictive prompts.

## Sharp vs Public Heuristic

The first-pass heuristic is intentionally rules-based:

- identify sharp books from the existing weight map
- detect which books moved first on the persisted timeline
- check whether broader books later converge or remain split
- downgrade confidence when the sample is sparse or fragmented

Every pressure label includes a deterministic explanation string and a `low` / `medium` / `high` confidence tier.

## Value Persistence Semantics

Historical odds also describe whether an edge was fleeting or stable.

`ValueTimingSignal` tracks:

- `firstPositiveEvAt`
- `lastPositiveEvAt`
- `positiveEvDurationSeconds`
- `valuePersistence`
- `edgeTrend`

Persistence labels:

- `fleeting`: brief positive-EV window with weak continuity
- `developing`: positive-EV window is building but still short
- `stable`: positive EV has persisted long enough to trust more than a flicker
- `stale`: value may still screen positive, but the last observed quote is too old
- `unknown`: not enough history to classify safely

## Signal Compression Principles (Wide Boards)

To improve scan speed without hiding depth:
- pinned books first
- then book tier ordering (sharp/signal/mainstream/promo)
- pinned-focused ranking/sort controls for execution-first views
- compact pinned-vs-global context in top opportunity cards

Table/grid remains primary; no card-only fallback mode is introduced.
