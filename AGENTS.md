# EmpirePicks — Agent Instructions

This document defines implementation rules for AI coding agents working on the EmpirePicks repository.

EmpirePicks is a **sports odds aggregation and betting analytics product** focused on **fair price discovery, line shopping, and analytically credible decision support**.

Current public product split:

- `Board` for ranked market scanning
- `Games` for event browsing
- `Game Detail` for event-level comparison
- `Internal` for protected diagnostics only

Agents must treat this repository as a production application, not a prototype. The goal is to preserve the existing odds engine and platform safety controls while upgrading the product into a professional, coherent, high-trust sportsbook analytics workstation.

---

# 1. Product Standard

EmpirePicks must feel closer to:

- OddsJam
- Unabated
- a clean trading terminal
- a disciplined analytics dashboard

EmpirePicks must **not** feel like:

- a generic Tailwind starter
- a card-heavy AI-generated dashboard
- a hero-banner marketing site
- a cluttered sports app
- a decorative data demo

Every change should improve one or more of the following:

1. clarity
2. scan speed
3. actionability
4. analytical trust
5. production quality
6. consistency between output, UI, and logic

The product is not a general sports destination. It is a **decision-support tool for evaluating market price versus fair price**.

---

# 2. Core Product Questions

Every public-facing UI surface should help the user answer these questions quickly:

1. What is the current best actionable line?
2. What does the market consensus imply is fair?
3. Is the gap between offered price and fair price meaningful?
4. How trustworthy is this signal?
5. Which book should the user act on, if any?

If a feature, section, label, metric, card, or interaction does not improve one of those outcomes, it should be removed, simplified, or moved to an internal surface.

---

# 3. Tech Stack

Frontend
- Next.js (App Router)
- React
- TypeScript

Backend
- Next.js API routes
- Node.js runtime
- Odds API integration

Infrastructure
- Vercel deployment
- Optional Upstash Redis cache and persistence

Compatibility requirements:
- Node >= 20

Agents must preserve compatibility with the existing stack and production runtime expectations. fileciteturn1file0 fileciteturn1file1

---

# 4. Repository Structure

Agents must understand the repository before making structural changes.

Primary areas:

```text
app/
  api/
  games/
  game/
  internal/

lib/
  server/
  server/odds/
  ui/

scripts/
```

Critical domain logic lives in:

```text
lib/server/odds/
```

Agents must review this directory carefully before modifying:
- odds normalization
- vig removal
- book weighting
- fair price computation
- EV calculation
- suppression logic
- ranking logic
- history and persistence-related behavior

Do not scatter pricing logic into UI components.

---

# 5. Development and Validation

Local setup:

```bash
npm ci
npm run dev
```

Production verification:

```bash
npm run build
npm run start
```

Required validation before submitting changes:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Visual regression workflow:

```bash
npm run test:visual
npm run test:visual -- --update
```

Agents should preserve and expand this quality bar, not weaken it. fileciteturn1file0

---

# 6. Environment and Operational Inputs

Agents should preserve support for the repository’s existing environment controls, including:

- `ODDS_API_BASE`
- `ODDS_API_ALLOWED_HOSTS`
- `ODDS_ALLOWED_SPORT_KEYS`
- `ODDS_CALIBRATION_OVERRIDES_JSON`
- `ODDS_SNAPSHOT_COLLECTION_ENABLED`
- `ODDS_SNAPSHOT_INTERVAL_SECONDS`
- `ODDS_SNAPSHOT_RETENTION_HOURS`
- `ODDS_SNAPSHOT_BATCH_SIZE`
- `ODDS_HISTORY_SHORT_WINDOW_MINUTES`
- `ODDS_HISTORY_LONG_WINDOW_MINUTES`
- `ODDS_HISTORY_LIVE_RANKING_MODE`
- `ODDS_VALUE_PERSISTENCE_THRESHOLD_PCT`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `EMPIRE_INTERNAL_API_KEY`
- `ODDS_TIMELINE_TTL_SECONDS`
- `ODDS_VALIDATION_TTL_SECONDS`
- `ODDS_EVALUATION_TTL_SECONDS`
- `ODDS_DIAGNOSTICS_TTL_SECONDS`
- `EDGE_CACHE_S_MAXAGE`
- `EDGE_CACHE_SWR`

Do not remove or casually rename production controls without strong justification and a coordinated documentation update. fileciteturn1file1turn1file5

---

# 7. Core Domain Logic, Preserve the Math Pipeline

EmpirePicks revolves around **odds mathematics**.

Agents must preserve the core backend computation pipeline unless there is a clearly documented, intentional change with updated tests and comments.

## Step 1 — Convert American Odds to Implied Probability

\[
P =
\begin{cases}
\frac{100}{\text{Odds} + 100}, & \text{Odds} > 0 \\
\\
\frac{|\text{Odds}|}{|\text{Odds}| + 100}, & \text{Odds} < 0
\end{cases}
\]

If odds are non-finite or equal `0`:

\[
P = 0
\]

## Step 2 — Remove Vig Per Book, Per Market Pair

\[
P_i^{\text{no vig}} = \frac{P_i^{\text{raw}}}{\sum_j P_j^{\text{raw}}}
\]

If total is invalid:

\[
\sum_j P_j^{\text{raw}} \le 0 \Rightarrow P_i^{\text{no vig}} = \frac{1}{N}
\]

## Step 3 — Apply Book Weights

Each sportsbook receives a weight based on signal quality.

### Tier 1 — Sharp / Market-Making Books

\[
w_{\text{Pinnacle}} = 1.0,\quad
w_{\text{Circa}} = 0.9,\quad
w_{\text{Bookmaker}} = 0.85,\quad
w_{\text{BetCris}} = 0.85
\]

### Tier 2 — Strong Signal / Hybrid Books

\[
w_{\text{BetOnline}} = 0.75,\quad
w_{\text{Heritage}} = 0.7,\quad
w_{\text{LowVig}} = 0.7
\]

### Tier 3 — Major U.S. Market Books

\[
w_{\text{DraftKings}} = 0.4,\quad
w_{\text{FanDuel}} = 0.38,\quad
w_{\text{Caesars}} = 0.34,\quad
w_{\text{BetMGM}} = 0.34,\quad
w_{\text{PointsBet}} = 0.32,\quad
w_{\text{Barstool}} = 0.3,\quad
w_{\text{ESPNBet}} = 0.3
\]

### Tier 4 — Recreational / Promotional Books

\[
w_{\text{BetRivers}} = 0.28,\quad
w_{\text{Unibet}} = 0.28,\quad
w_{\text{WynnBet}} = 0.26,\quad
w_{\text{FOXBet}} = 0.25,\quad
w_{\text{SuperBook}} = 0.25
\]

### Tier 5 — Exchange / Niche / Regional

\[
w_{\text{Matchbook}} = 0.6,\quad
w_{\text{BetfairExchange}} = 0.6,\quad
w_{\text{Smarkets}} = 0.6
\]

### Fallback

\[
w_{\text{unknown}} = 0.12
\]

### Model Overrides

- `weighted` default, use defined weights
- `sharp`, restrict to Tier 1
- `equal`, set all weights to `1`

## Step 4 — Calculate Fair Probability

\[
P_{\text{fair}} =
\frac{\sum_i w_i \cdot P_i^{\text{no vig}}}{\sum_i w_i}
\]

If total weight is invalid:

\[
P_{\text{fair}} = 0.5
\]

## Step 5 — Convert Fair Probability to American Odds

\[
\text{Odds} =
\begin{cases}
-\frac{P_{\text{fair}}}{1 - P_{\text{fair}}} \times 100, & P_{\text{fair}} \ge 0.5 \\
\\
\frac{1 - P_{\text{fair}}}{P_{\text{fair}}} \times 100, & P_{\text{fair}} < 0.5
\end{cases}
\]

Clamp:

\[
P_{\text{fair}} \in [0.001, 0.999]
\]

## Step 6 — Expected Value

\[
\text{Decimal} =
\begin{cases}
1 + \frac{\text{Odds}}{100}, & \text{Odds} > 0 \\
\\
1 + \frac{100}{|\text{Odds}|}, & \text{Odds} < 0
\end{cases}
\]

\[
EV = (P_{\text{fair}} \cdot \text{Decimal}) - 1
\]

\[
EV\% = EV \times 100
\]

## Runtime Constraints

- Markets are grouped by identical line values
- Fair price is computed within each group
- EV may be suppressed when coverage or confidence thresholds fail
- `/api/fair` defaults to `model=weighted` and `minBooks=4`

Agents must not casually change these semantics. Any intentional change to fair-line or EV behavior must:
- be commented
- be tested
- explain why the change improves correctness or product quality

---

# 8. Product Surfaces

EmpirePicks should be organized into a small number of intentional surfaces.

## Public surfaces

1. **Board**
   - primary scanning surface
   - dense, sortable, filterable table
   - optimized for line shopping and fair-price evaluation

2. **Game Detail**
   - one event with deeper market comparison
   - clear book comparison
   - fair-price context
   - real history or movement data only when supported

3. **Preferences**
   - pinned books
   - default league
   - model
   - thresholds or display preferences as supported

## Internal surfaces

Restricted or operator surfaces include:
- diagnostics
- evaluation
- timeline
- snapshot controls
- internal engine pages

Internal surfaces must remain separate from the public product and must not leak internal engine jargon into the public UI. fileciteturn1file1turn1file5turn1file33

---

# 9. Information Architecture Rules

Agents must preserve a disciplined page hierarchy.

Each page should have:
- one primary purpose
- one dominant data structure
- one clear reading order
- minimal redundant content

## Board page

The board should generally consist of:
1. compact header
2. filter and sort controls
3. main results table
4. optional detail drawer or route transition

Do not place large hero banners, introductory marketing prose, or oversized KPI cards above the board.

## Game detail page

The event page should generally consist of:
1. event header
2. consensus summary
3. market tabs
4. book comparison table
5. movement or history, only when real
6. concise rationale and data-quality notes

---

# 10. UI Principles

Agents must prioritize:

- clarity
- low cognitive load
- data density
- scan speed
- trustworthiness
- consistency

Preferred patterns:
- sportsbook dashboards
- financial trading dashboards
- dense tables
- restrained panels
- disciplined status indicators

Avoid:
- large hero banners
- excessive animation
- heavy gradients
- decorative glow effects
- glassmorphism
- giant card grids
- “insight” cards that restate existing numbers

Tables are preferred over cards for core analytical views. fileciteturn1file1

---

# 11. Visual Design Rules

The visual system must be restrained.

## Use
- neutral base palette
- one clear accent color
- one success color
- one warning color
- one danger color
- thin borders
- compact spacing
- consistent radius
- minimal shadow
- tabular numeric alignment where appropriate

## Avoid
- arbitrary color usage
- multiple badge systems for the same concept
- decorative gradients
- oversized empty space
- excessive typography variation

Color must communicate meaning:
- green for favorable or actionable
- amber for caution, staleness, or weak signal
- red for negative or failed state
- accent color for interaction and focus

Do not color every metric independently.

---

# 12. Copy Standards

All UI copy must be short, direct, and professional.

Use labels like:
- Edge
- Fair odds
- Best line
- Books
- Confidence
- Stale
- Updated
- Market width

Avoid labels like:
- market opportunity insight
- smart confidence engine
- consensus intelligence summary
- high-value signal analysis

Do not use:
- marketing language
- hype language
- fluffy adjectives
- repeated explanations
- chatty empty states

Error and empty states must be sober and useful.

Examples:
- `Odds unavailable. Showing cached data.`
- `No qualifying markets for current filters.`
- `Internal access required.`
- `Feed delayed. Rankings may be stale.`

---

# 13. Metric Discipline

Agents must rationalize and simplify metrics.

The public board should focus on a small set of primary numbers. A strong default surface usually includes:

- Event
- Market
- Best line
- Book
- Fair odds
- Edge or EV
- Confidence
- Books contributing
- Updated or stale state

Secondary metrics should only appear when they improve the decision:
- market width
- pinned-book actionability
- movement signal
- broad consensus or fragmented signal

Do not expose every intermediate metric in the main UI.
Do not duplicate the same value across cards, row details, and side panels.

One strong number is better than five weak ones.

---

# 14. Board UX Requirements

The board is the centerpiece of the product.

It must behave like a professional workstation.

## Expected board behaviors

- sticky table header
- sortable columns
- compact rows
- aligned numeric columns
- quick scan path to best actionable number
- clear separation between event context and market context
- stable rendering under larger result sets

## Suggested board columns

A default structure may resemble:

| Event | Market | Best | Book | Fair | Edge | Confidence | Books | Updated |

Agents may evolve the structure, but the board must always make these items obvious:
- what the event is
- what side or market is being evaluated
- what the best current number is
- which book offers it
- what fair consensus says
- whether the difference is actionable
- how trustworthy and fresh the signal is

Do not convert the board into a maze of expanding cards.

---

# 15. Game Detail Requirements

The event page should function as a legitimate analysis surface.

Expected sections:
1. event header
2. consensus summary
3. market tabs
4. book comparison table
5. movement or history, if real and persisted
6. concise rationale or data-quality notes

Book comparison tables should be disciplined, not decorative.

Do not add:
- giant ornamental charts
- repetitive stat cards
- fake sparkline histories
- explanatory prose that merely restates table data

If history is not real, omit it.

---

# 16. Public vs Internal Boundary

Agents must maintain a strict distinction between public product output and internal/operator tooling.

## Public UI should expose
- board data
- event detail
- fair-price context
- actionable book comparison
- limited, defensible quality indicators

## Internal UI may expose
- calibration details
- persistence health
- diagnostics payloads
- timeline internals
- evaluation outputs
- snapshot controls

Do not mix internal telemetry into public-facing rows or panels.
Do not expose operator semantics unless the route is explicitly internal and protected. fileciteturn1file33

---

# 17. Frontend Architecture Rules

Agents should move the UI toward a deliberate component system.

Preferred structure, or equivalent:

```text
components/
  board/
  game/
  filters/
  table/
  layout/
  feedback/
  internal/
  primitives/
```

Or, if retained under `lib/ui`, preserve the same separation in practice.

## Component tiers

### Primitives
- Button
- Input
- Select
- Tabs
- Badge
- Table
- Panel
- Skeleton
- Divider

### Product components
- BoardTable
- BoardRow
- MarketCell
- EdgeCell
- ConfidenceBadge
- EventHeader
- MarketTabs
- BookComparisonTable
- DiagnosticsPanel

### Page orchestrators
- BoardView
- GameDetailView
- InternalEngineView

Rules:
- no giant page components with inline everything
- no repeated formatting logic in many files
- no repeated status logic in many files
- no UI component doing backend domain computation

---

# 18. View Models and Data Shaping

Agents should not let raw backend structures leak directly into display components.

Create or preserve explicit shaping layers for:
- board rows
- event summaries
- comparison rows
- internal diagnostics views

Recommended concept:

```text
lib/ui/view-models/
  boardViewModel.ts
  gameDetailViewModel.ts
  diagnosticsViewModel.ts
```

View models should:
- normalize labels
- format display-safe values
- suppress irrelevant fields
- separate public-safe and internal-only semantics
- reduce conditionals inside rendering components

The UI should not have to guess whether a field is:
- stale
- hidden
- null
- public-safe
- suppressible
- worth displaying

Shape that upstream in view-model code.

---

# 19. Formatting Rules

Agents must centralize formatting for:
- American odds
- percentages
- timestamps
- freshness labels
- counts
- model labels
- null states

Formatting must be consistent.

Examples:
- `+110`
- `-125`
- `3.4%`
- `4 books`
- `Updated 18s ago`
- `Stale`
- `—`

Rules:
- positive odds always include `+`
- numeric alignment should be visually stable
- null states should be intentional
- stale values must not look the same as live values

---

# 20. Performance Rules

Agents must minimize:
- duplicate API calls
- unnecessary server renders
- large client bundles
- repeated render-time calculations
- avoidable hydration

Preferred solutions:
- API caching
- Redis-backed persistence where configured
- shared fetch paths
- server-side shaping
- incremental updates where justified

Do not hide bad architecture behind memoization.
Fix data flow first.

Observed internal and operator workflows already present must be preserved or improved:
- internal diagnostics APIs
- internal engine page
- snapshot collection routes
- internal session management
- auth-gated internal surfaces fileciteturn1file1turn1file5turn1file33

---

# 21. Error Handling Rules

API failures must not break the UI.

Agents should implement:
- try/catch where appropriate
- stable error contracts
- fallback states
- honest cached-data messaging
- loading states that match real fetch behavior

If odds API requests fail:
- return cached data if available
- keep error output generic and safe
- avoid leaking upstream details to public responses

Public error states should remain compact and useful.

---

# 22. Security Rules

Agents must never:
- expose API keys
- log environment variables
- commit `.env` files
- weaken internal route protection
- bypass trusted upstream host controls

All secrets belong in:
- `.env.local` locally
- deployment environment variables in production

Existing security posture such as CSP and response headers should be preserved or improved, not removed. fileciteturn1file2turn1file33

---

# 23. Coding Standards

TypeScript strict mode is required.

Rules:
- no `any`
- prefer functional components
- explicit return types where beneficial
- maintain clear type contracts
- use `@/*` import paths where already supported

Naming:
- camelCase for variables and functions
- PascalCase for React components
- kebab-case for routes

Agents should leave the codebase more structured than they found it.

---

# 24. Testing Expectations

Agents should add or maintain tests for:
- odds conversion
- vig removal
- fair probability
- fair odds conversion
- EV calculations
- suppression logic
- view-model shaping
- stale and confidence labeling where relevant

Testing framework:
- Node’s built-in test runner via `tsx --test`

Visual regression should cover critical product surfaces:
- board
- game detail
- major error states
- internal surfaces where worthwhile

Do not merge large UI or domain changes without tests or a clear reason they cannot be tested. fileciteturn1file0

---

# 25. Commit Guidelines

Use clear commit messages such as:

- `feat: rebuild board table hierarchy`
- `fix: correct vig normalization fallback`
- `refactor: introduce board view models`
- `perf: reduce duplicate board fetches`
- `test: add fair odds shaping coverage`

Avoid vague messages.

---

# 26. Deployment and Production Checks

Production environment:
- Vercel

Build command:
- `npm run build`

Serve locally:
- `npm run start`

Observed post-deploy checks include:
1. homepage loads
2. `/games` renders
3. `/api/health` returns success
4. `/api/status` reports healthy services

Agents must keep deployment expectations and post-deploy verification paths working. fileciteturn1file1

---

# 27. Agent Guardrails

Agents must not:
- remove the core odds math logic
- casually break public API behavior
- expose internal functionality publicly
- replace tables with decorative card walls
- add marketing-style hero sections to analytical views
- introduce fake history, fake signals, or decorative “insights”

Agents should:
- make deliberate, explainable changes
- improve trust and clarity
- maintain backward compatibility where practical
- document meaningful structural changes
- simplify before adding complexity

When choosing between “more features” and “better product discipline,” choose better product discipline.

---

# 28. Anti-Slop Rules

These rules are explicit.

## Never do these
- do not add large hero sections to the board
- do not use gradients as hierarchy
- do not create a wall of KPI cards
- do not repeat the same metric across multiple containers
- do not label every number with jargon
- do not add decorative badges without semantic purpose
- do not expose internal engine metrics in public UI
- do not create fake line-history or fake sparkline graphics
- do not generate fluffy copy
- do not prioritize novelty over scan speed

## Always do these
- prefer tables over ornamental cards
- prefer dense clarity over empty space
- prefer one dominant number over many minor ones
- prefer direct labels over explanatory prose
- prefer neutral design over trendy design
- prefer real product truth over visual theater
- prefer stable formatting over clever formatting

---

# 29. Future Roadmap

Potential future features may include:
- line movement tracking
- steam move alerts
- CLV tracking
- sharp vs public indicators
- player prop analytics

Agents may propose improvements, but should not implement major new feature areas without explicit instruction.

---

# End of AGENTS.md
