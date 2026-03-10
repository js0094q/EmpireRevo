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

Movement summaries remain selective and now feed timing labels:
- sharp-led movement
- retail-only drift
- out-of-sync behavior
- weak signal due to sparse history

## Phase 6 Historical Pressure Labels

Historical timelines now support descriptive pressure signals derived from persisted snapshots:

- `sharp-led move`
- `mainstream lagging`
- `pinned lagging`
- `broad market shift`
- `isolated stale quote`

These labels describe observed sequencing and divergence. They are not predictive prompts.

## Signal Compression Principles (Wide Boards)

To improve scan speed without hiding depth:
- pinned books first
- then book tier ordering (sharp/signal/mainstream/promo)
- pinned-focused ranking/sort controls for execution-first views
- compact pinned-vs-global context in top opportunity cards

Table/grid remains primary; no card-only fallback mode is introduced.
