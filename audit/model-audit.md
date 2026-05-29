# EmpirePicks Model and Data Audit

Date: May 29, 2026

## Summary

The model code is materially stronger than the public conversion layer. The fair-line pipeline follows the expected shape: normalize odds, remove vig within each market group, apply weighted consensus, compute fair American odds, compute probability gap and EV, then rank with confidence/freshness penalties. The largest launch risks are operational transparency and stale/missing data handling at the product boundary, not obvious math defects.

## Prediction Pipeline

Reviewed files:

- [lib/server/odds/oddsService.ts](/Users/josephstewart/Documents/EmpireRevo/lib/server/odds/oddsService.ts)
- [lib/server/odds/normalize.ts](/Users/josephstewart/Documents/EmpireRevo/lib/server/odds/normalize.ts)
- [lib/server/odds/fairEngine.ts](/Users/josephstewart/Documents/EmpireRevo/lib/server/odds/fairEngine.ts)
- [lib/server/odds/snapshotPersistence.ts](/Users/josephstewart/Documents/EmpireRevo/lib/server/odds/snapshotPersistence.ts)
- [lib/server/odds/validationEvents.ts](/Users/josephstewart/Documents/EmpireRevo/lib/server/odds/validationEvents.ts)

Pipeline:

1. Upstream odds are fetched through `getNormalizedOdds`.
2. Events are normalized into canonical league/event/book/market shapes.
3. Fair board is built by market and model.
4. Snapshots are persisted opportunistically.
5. Historical movement is attached when enabled.
6. Validation events are emitted for later CLV/ROI evaluation.

## Findings

| Issue | Why it matters | Severity | Expected impact | Exact implementation recommendation | Files requiring modification |
|---|---|---:|---|---|---|
| Homepage public route fails fully when odds key/feed is missing | A marketing/conversion page should not disappear because a data feed is unavailable. | Critical | Trust and resilience | Render commercial content first; show board-unavailable state inside board section only. | `app/page.tsx` |
| Public UI does not expose validation methodology | Model credibility is not obvious to prospects. | High | Trust | Add public transparency page linked from CTAs. | `app/transparency/page.tsx` |
| Backtesting and outcome data are internal only | Good for safety, but paid users need an eventual audit trail. | High | Retention | Add future public history surface once sample-size gate is met. | future `app/history/page.tsx` |
| Spread/total EV suppression is correct but not obvious | Suppressed EV may confuse users when markets differ by point. | Medium | Reduced support friction | Add FAQ/transparency language that spread/total EV can be suppressed when coverage/confidence is insufficient. | `app/faq/page.tsx`, `app/transparency/page.tsx` |
| Stale normalized fallback is memory-local | Good for short outages, but serverless instances may not share stale state. | Medium | Stability | Confirm Redis-backed snapshots are active in production and monitor fallback hit rate. | deployment/runtime configuration |

## Expected Value Engine

Reviewed:

- [lib/server/odds/fairMath.ts](/Users/josephstewart/Documents/EmpireRevo/lib/server/odds/fairMath.ts)
- [lib/server/odds/ev.ts](/Users/josephstewart/Documents/EmpireRevo/lib/server/odds/ev.ts)
- [lib/server/odds/fairEngine.ts](/Users/josephstewart/Documents/EmpireRevo/lib/server/odds/fairEngine.ts)

Formula review:

- American odds to implied probability is standard.
- Vig removal normalizes valid implied probabilities to sum to 1.
- Weighted fair probability excludes invalid probabilities and zero/negative weights.
- EV uses `fair_prob * decimal_odds - 1`, expressed as percent return on stake.
- ROI uses a flat one-unit stake model and excludes unknown outcomes from settled ROI.

No mathematical defect was identified in the reviewed files.

## Historical Backtesting

Reviewed:

- [docs/clv-and-evaluation.md](/Users/josephstewart/Documents/EmpireRevo/docs/clv-and-evaluation.md)
- [docs/phase-7-outcome-evaluation.md](/Users/josephstewart/Documents/EmpireRevo/docs/phase-7-outcome-evaluation.md)
- [lib/server/odds/evaluationRunner.ts](/Users/josephstewart/Documents/EmpireRevo/lib/server/odds/evaluationRunner.ts)
- [lib/server/odds/evaluationReport.ts](/Users/josephstewart/Documents/EmpireRevo/lib/server/odds/evaluationReport.ts)

Backtesting limitations are handled conservatively in code and docs: missing outcomes and missing close snapshots remain null-safe. Before launch, the product should avoid public ROI claims unless the source validation events, outcomes, close references, and sample sizes can be audited.
