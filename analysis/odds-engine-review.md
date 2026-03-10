# Odds Engine Review

## Source Files Inspected
- `lib/server/odds/fairMath.ts`
- `lib/server/odds/ev.ts`
- `lib/server/odds/bestLine.ts`
- `lib/server/odds/weights.ts`
- `lib/server/odds/aggregator.ts`
- `lib/server/odds/snapshots.ts`
- `lib/server/odds/movement.ts`
- `lib/server/odds/derive.ts`
- `lib/server/odds/fairEngine.ts`
- `lib/odds/schemas.ts`
- `tests/fairMath.test.ts`, `tests/movement.test.ts`
- `docs/` (expected `docs/odds-math.md`, but the file is missing)

## 1. Odds Conversion
- `americanToProbability` / `impliedProbFromAmerican` (`lib/server/odds/fairMath.ts:11`) use the standard ±100 formulas with clamping to `[0.001, 0.999]`. Tests cover simple values (`tests/fairMath.test.ts`).
- `probabilityToAmerican` / `americanFromProb` invert the relationship, again clamping but rounding to integers. Works for single moneyline odds but does not expose decimal odds.
- Issue: Conversion utilities live in two shapes (e.g., `americanToProbability` and `impliedProbFromAmerican`) which are redundant. More importantly, there is no audit trail verifying the math against the missing `docs/odds-math.md`, so we cannot confirm the clamp thresholds or whether fractional cents should be supported.

## 2. Vig Removal
- `removeVig` (`fairMath.ts:32`) normalizes an arbitrary list of implied probs so their sum = 1. `devigTwoWay` simply calls `removeVig` for a pair of prices.
- `deriveGames` also normalizes per-market outcomes (`normalizeBookMarket` in `lib/server/odds/derive.ts`), but it recomputes equal-weight, weighted, and "sharp" weighted probabilities separately.
- Edge cases: when the total probability is zero/NaN, `removeVig` falls back to an even split regardless of price level, which may hide upstream data errors. There is no guard ensuring home/away ordering is consistent before devigging, so mislabeled outcomes could swap probabilities silently.

## 3. Fair Odds Calculation
- `weightedFairProbability` (`fairMath.ts:46`) takes `{probability, weight}` pairs and produces a weighted average (fallback to simple average). `probabilityToAmerican` converts the consensus prob back into an American fair price.
- `lib/server/odds/aggregator.ts` applies this per outcome: collect all sportsbook rows, strip vig per book, weight by `weights.ts`, compute fair probability + price, and emit EV + edge colors.
- `lib/server/odds/derive.ts` takes a different approach: it keeps equal-weight, weighted, and sharp-only probabilities plus variance-based heuristics. This means two different "fair" models exist with no reconciliation.
- **Critical bug:** `lib/server/odds/fairEngine.ts` is outdated. It references `event.bookMarkets`, `event.id`, and other fields that do not exist on `NormalizedEventOdds`. The exported `buildFairBoard` signature is `(events, league, model)` but `/app/api/fair/route.ts` calls it with an options object and never awaits the async function, so at runtime `payload` is a `Promise`, making `payload.events` undefined. The route is suppressed with `// @ts-nocheck`, but unless some bundler transpilation rewrites this, `/api/fair` cannot produce the documented schema. This is the engine powering both `/` and `/game/[eventId]`, so the platform currently lacks a functioning "fair board" response.
- Comparison vs spec: `docs/odds-math.md` referenced in the task does not exist in the repo, meaning none of the math has been validated against an authoritative document. This is a major governance gap.

## 4. EV Calculation
- `calculateEvPercent` (`lib/server/odds/ev.ts`) implements `(sportsbookProbability / fairProbability) - 1` and returns a percentage. It guards against zero/NaN by returning 0.
- `edgePct` (`fairMath.ts:83`) returns `(bookProbNoVig - fairProb) * 100`, which is conceptually book minus fair, the inverse of `calculateEvPercent`. Both metrics appear in different places (legacy board vs new aggregator) without consistent naming.
- Concerns: EV is computed after converting to implied probabilities per book, but there is no guarantee that `fairProbability` is non-zero; if the weighting returns 0, EV locks at 0, masking arbitrage spots. Spread/total bets that share identical probabilities but different points are not differentiated—`calculateEvPercent` ignores `book.point`, so a -7 spread and -7.5 will be treated equally.

## 5. Sportsbook Aggregation
- `lib/server/odds/aggregator.ts` drives the new `/api/odds` endpoint and `/app/games`. Flow:
  1. Fetch Odds API data (`fetchOddsFromUpstream`).
  2. Normalize to `NormalizedEventOdds` (`normalize.ts`).
  3. Filter to one market key (moneyline/spread/total) and loop outcomes by index (assumes every book orders outcomes identically).
  4. For each book, convert odds to implied probs, strip vig, assign weights, and capture best odds + EV.
  5. Track a very simple movement snapshot (`lib/server/odds/snapshots.ts`) that only retains open/current odds and a delta arrow.
  6. Summarize the game by picking the outcome with the highest EV.
- Edge cases / bugs:
  - Outcome matching by index fails whenever sportsbooks switch ordering (common on totals/spreads). Labels exist but are only used when deriving outcome names; they are not used to align data, so mismatched ordering will combine unrelated prices.
  - Spread/total markets ignore the `point` property entirely, so the "best price" might pair a line at +7.5 with consensus probabilities calculated off +7 from another book.
  - `recordSnapshot` duplicates logic already handled by the more robust `movement.ts`, so different parts of the app disagree on what "line movement" means.
  - Only one market per request is fetched (`markets: market`). Legacy board fetches all markets at once. No facility exists for multi-market aggregation or multi-sport caching.
  - Aggregator returns `sportKey` but not `league` metadata, which the UI subsequently has to infer.

## Summary vs Spec
- Because `docs/odds-math.md` is absent, none of the math is traceable to a written spec. The code mixes multiple interpretations of "fair line" and "EV" across `aggregator.ts`, `derive.ts`, and `fairEngine.ts`, and the legacy `/api/fair` route is fundamentally broken. Until the missing documentation is restored and the engines are reconciled, the platform cannot be considered mathematically correct or production-ready.
