# Phase 6.1 CLV Normalization

Phase 6.1 keeps the Phase 6 architecture and corrects CLV semantics.

## Why This Change

Raw American-odds subtraction is convenient for display but not authoritative for CLV evaluation.
American odds are non-linear, so numerical subtraction in that space can overstate or understate magnitude.

Phase 6.1 makes implied probability the authoritative CLV comparison space.

## Authoritative CLV Fields

CLV is now computed as:

- `betImpliedProb`
- `closeImpliedProb`
- `clvProbDelta = closeImpliedProb - betImpliedProb`
- `beatClose = clvProbDelta > 0`

Interpretation:

- positive `clvProbDelta` means the captured price was better than close for the same side
- negative `clvProbDelta` means it was worse than close

## Display-Only Compatibility Fields

For compatibility with existing internal consumers, CLV still includes:

- `displayAmericanDelta`
- `clvAmericanDelta` (deprecated alias)

These are display helpers only, not the authoritative evaluation metric.

## Close Reference Labeling

Every CLV payload now carries `closeReference`, and summaries include methodology metadata:

- `closeReference`
- `clvSpace: implied_probability`
- `displaySpace: american_odds`
- default-vs-selected reference status

## Null-Safe Behavior

If bet or close prices are missing/invalid:

- implied probability fields are `null`
- CLV delta is `null`
- `beatClose` is `null`

No close inference or synthetic fallback is applied.
