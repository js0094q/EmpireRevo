# EmpirePicks Odds Math

## 1) American Odds -> Implied Prob

For positive American odds:

`Implied Prob = 100 / (odds + 100)`

For negative American odds:

`Implied Prob = |odds| / (|odds| + 100)`

Examples:
- `+150 -> 0.40`
- `-150 -> 0.60`

## 2) Vig Removal (Two-Way)

Given two implied probabilities from one sportsbook:

- `p1_raw`
- `p2_raw`

No-vig probabilities:

- `p1_no_vig = p1_raw / (p1_raw + p2_raw)`
- `p2_no_vig = p2_raw / (p1_raw + p2_raw)`

This guarantees `p1_no_vig + p2_no_vig = 1`.

## 3) Weighted Consensus Fair Prob

EmpirePicks computes fair probability from no-vig probabilities using sportsbook weights.

`Fair Prob = sum(no_vig_prob_i * weight_i) / sum(weight_i)`

Safeguard:
- If total weight is zero, the engine returns neutral `0.50` unless an explicit unweighted fallback is intentionally enabled.

## 4) Fair Prob -> Fair American Price

If `Fair Prob >= 0.5`:

`Fair American = -((Fair Prob / (1 - Fair Prob)) * 100)`

If `Fair Prob < 0.5`:

`Fair American = (((1 - Fair Prob) / Fair Prob) * 100)`

Rounded to nearest integer.

## 5) Edge Formula

`Edge = (Fair Prob - No-Vig Prob) * 100`

Edge is probability-point difference versus no-vig book probability.

## 6) EV Formula

Convert American odds to decimal:

- Positive: `Decimal = 1 + (odds / 100)`
- Negative: `Decimal = 1 + (100 / |odds|)`

Expected Value:

`EV = (Fair Prob * Decimal Odds) - 1`

`EV% = EV * 100`

## 7) Market Comparison Rules

### Moneyline
- Best price = highest payout odds for that side.

### Spread
- Compare point value first, then price.
- Better number outranks slightly better juice when point difference is meaningful.

### Totals
- Compare total number before price.
- `Over`: lower total is better.
- `Under`: higher total is better.

## 8) EV Defensibility Boundaries

- Moneyline EV is shown directly.
- Spread/totals EV is marked **qualified** and down-weighted in ranking.
- Opportunity ranking does not rely on EV alone, especially outside moneyline markets.

## 9) Sparse-Market Handling

Thin or stale markets reduce confidence and ranking through penalties for:
- low contributing-book count
- low sharp-book participation
- stale timestamps
- sparse movement history
- high exclusion count

## 10) Stale-Line Interpretation Notes

Stale-line flags are conservative and contextual:
- `stale_price` and `lagging_book` can be actionable when confidence is adequate.
- `off_market` indicates likely noisy outlier risk in weaker market conditions.
- `best_market_confirmed` indicates executable best price with broader market confirmation.

## 11) Explicit Product Labels

- **Implied Prob**
- **No-Vig Prob**
- **Fair Prob**
- **Fair Price**
- **Edge**
- **Expected Value**
