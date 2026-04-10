# EmpirePicks Production Overhaul Plan

## Role and Objective

Overhaul this repository into a production-grade betting analytics product that looks, reads, and behaves like a serious professional tool, not an AI-generated prototype.

The end state must be:

- visually disciplined
- analytically credible
- fast
- internally consistent
- easy to trust
- easy to scan
- production-safe
- opinionated in UI hierarchy
- minimal in language
- free of fake sophistication, decorative clutter, and redundant metrics

This repo already has strong foundations:

- Next.js App Router with React and TypeScript
- strict TypeScript enabled
- core scripts for lint, typecheck, test, and build
- explicit odds math and fair-line modeling rules
- CSP and security headers
- internal diagnostics and operator surfaces
- Redis/rate-limit support
- existing product direction centered on fair odds, EV, line shopping, and diagnostics

Use those foundations, but overhaul the product and codebase so the output feels like a real premium sportsbook analytics workstation. Do not treat this as a visual polish pass. Treat it as a product, architecture, UX, language, and system-quality reset.

References for the current repo constraints and expectations:
- `package.json`
- `AGENTS.md`
- `README.md`
- `next.config.mjs`
- `tsconfig.json`

---

## Non-Negotiable Product Standard

The product must feel closer to:

- OddsJam
- Unabated
- a clean institutional trading terminal
- a high-trust analytics dashboard

The product must **not** feel like:

- a startup landing page
- a generic Tailwind template
- a hero-banner marketing site
- a card wall with too much text
- a dashboard that labels every number with jargon
- an AI-generated sports betting app with decorative gradients and arbitrary badges

---

## Core Product Principle

EmpirePicks is not a general “sports app.”

It is a **decision-support tool for line shopping and fair price evaluation**.

Every page, component, label, table, metric, and interaction must answer one of these questions:

1. What is the market consensus fair price?
2. Where is the best current actionable number?
3. Is the edge real, stale, fragile, or not worth attention?
4. Why is this game or market ranked where it is?
5. What can the user do immediately with confidence?

If a UI element does not improve one of those outcomes, remove it.

---

## Phase 1 — Reframe the Product Before Rewriting UI

### Objective

Define a tighter product structure before touching implementation.

### Required product framing

The app should be organized into a small number of intentional surfaces:

1. **Board**
   - main scanning surface
   - dense, sortable, filterable, professional table
   - user should find actionable edges in seconds

2. **Game Detail**
   - one event, expanded market depth
   - clear comparison across books
   - line history where credible
   - fair-line explanation and confidence context

3. **Market/Engine Diagnostics**
   - separate from public product surface
   - operator or advanced user only
   - internal tone, not consumer tone

4. **Settings / Preferences**
   - pinned books
   - default league
   - ranking model
   - stake/unit display preferences
   - odds format preferences if eventually added

### Remove ambiguity

Do not mix these concerns into a single cluttered page.

Public product:
- board
- game detail
- lightweight preferences

Restricted/internal:
- evaluation
- diagnostics
- timeline
- snapshot controls

---

## Phase 2 — Rewrite the Information Architecture

### Objective

Make the app understandable at a glance.

### Top-level navigation should be minimal

Use something like:

- Board
- Games
- History or Tracking, only if real and ready
- Internal, protected

Do not expose unfinished concepts in navigation.

### Page hierarchy rules

Each page must have:

- one clear primary action
- one clear primary data structure
- one dominant reading order
- zero decorative sections that do not change decisions

### Board page structure

The board should be:

1. compact header
2. filter and control rail
3. primary results table
4. optional secondary drawer or details preview

The board should not open with a large hero, large explanatory prose block, or oversized KPI tiles.

### Game detail page structure

Each game detail page should have:

1. event header
2. consensus summary row
3. market tabs
4. book comparison table
5. line movement/history, only if sourced honestly
6. rationale and data-quality notes
7. related internal diagnostic data only if user is authorized

---

## Phase 3 — Establish a Professional Visual System

### Objective

Replace “AI slop” styling with disciplined visual rules.

### Visual design rules

Use a restrained system:

- neutral base palette
- one accent color for actions and highlights
- one success tone
- one warning tone
- one danger tone
- thin borders
- tight spacing
- dense but readable typography
- consistent radius
- minimal shadows
- almost no gradients
- almost no glassmorphism
- no glow effects
- no gimmick animations

### Typography

Use a restrained type scale.

Suggested hierarchy:

- Page title: strong, compact
- Section title: medium weight
- Table headers: small caps or dense uppercase
- Body labels: muted and short
- Numeric data: tabular and prominent
- Microcopy: sparse and useful

Typography must signal confidence. Avoid blo-y language and avoid sentence-case explanations everywhere.

### Layout principles

Prefer:

- tables over cards
- rows over stacked promo blocks
- side panels over modal overuse
- inline context over tooltip overload

Avoid:

- giant spacing
- oversized pills everywhere
- stacked “insight” cards for everything
- duplicated values in multiple locations
- dashboard cosmetics without analytical purpose

### Color use

Color should mean something:

- green only for favorable/actionable positive value
- red only for negative or risk states
- amber only for stale, weak, or caution states
- blue or brand accent only for interactive focus and selected states

Do not color every metric independently.

---

## Phase 4 — Rewrite UX Copy to Sound Professional

### Objective

Eliminate verbose, AI-sounding, and redundant language.

### Copy standards

Every label must be:

- short
- specific
- unambiguous
- consistent across pages

Bad examples:
- “Expected opportunity score insight”
- “Consensus confidence intelligence”
- “Market movement snapshot analysis”

Better examples:
- Edge
- Fair odds
- Best line
- Books
- Market width
- Confidence
- Stale
- Last update

### Tone rules

Use:

- direct labels
- compact helper text
- operational language
- betting/trading-native terms

Avoid:

- marketing copy
- fluffy adjectives
- repeated definitions
- “smart”, “powerful”, “AI-driven”, “best-in-class”
- long explanatory paragraphs in the product UI

### Error and empty states

Error states should be sober and useful.

Examples:
- “Odds unavailable. Showing cached data.”
- “No qualifying markets for current filters.”
- “Internal access required.”
- “Feed delayed. Rankings may be stale.”

Do not use chatty empty states.

---

## Phase 5 — Simplify and Rationalize the Metrics

### Objective

Reduce cognitive overload and make each metric earn its place.

### Keep only the metrics that drive action

Primary board metrics should likely be limited to:

- Event
- Market
- Best line
- Best book
- Fair odds
- Edge or EV
- Confidence
- Books contributing
- Last update or stale indicator

Optional, secondary:
- market width
- pinned-book actionability
- movement indicator
- sharp/broad signal label

### Remove metric duplication

Do not show:
- fair probability and fair odds and raw implied probability and de-vigged probability and edge dollars and EV percent all in the same primary row unless there is a compelling reason

The board should optimize for scan speed.

### Suggested prioritization model

Primary number:
- best actionable price vs fair price

Secondary qualification:
- confidence
- coverage
- freshness

Tertiary detail:
- model explanation
- contributing books
- market depth
- pressure/movement context

---

## Phase 6 — Rebuild the Board as the Product Centerpiece

### Objective

Make the board the strongest surface in the application.

### Board requirements

The board should behave like a professional workstation.

It should support:

- dense rows
- sticky header
- sortable columns
- saved filters
- pinned books
- compact mode by default
- fast keyboard/mouse scanning
- stable alignment for all odds and percentages
- clear separation between market rows and event groups

### Table design rules

Each row should make it obvious:

- what event this is
- which side or market is being evaluated
- what the best current number is
- which book offers it
- what fair says
- whether the difference is meaningful
- whether confidence and freshness support action

### Recommended row design

Columns could be structured like:

| Event | Market | Best | Book | Fair | Edge | Confidence | Books | Updated |

Or grouped:

| Event / Market | Market Price | Consensus | Qualification |

### Board grouping

Support grouping by:

- sport
- game start time
- market type
- event

But keep the default view optimized for action, not exploration.

### Interaction rules

Single click:
- open details preview or route to game

Hover:
- minimal, only show supporting context

Expansion:
- inline market depth if fast and clean

Do not turn the board into a maze of expanding cards.

---

## Phase 7 — Make the Game Detail Page Analytical, Not Decorative

### Objective

Turn the event page into a legitimate research surface.

### Required sections

1. **Event header**
   - teams
   - start time
   - league
   - live/upcoming status
   - broad market health status

2. **Consensus summary**
   - best current line
   - consensus fair
   - best actionable book
   - number of contributing books
   - model used
   - confidence/freshness

3. **Market tabs**
   - moneyline
   - spread
   - total
   - future market types only if real

4. **Book comparison**
   - all books in a disciplined table
   - actionable pinned books separated if useful
   - show stale books clearly

5. **History and movement**
   - only with real persisted data
   - if no real data, omit rather than fake sparklines

6. **Model and quality notes**
   - short
   - explain why a number is ranked highly or suppressed

### Detail page anti-patterns

Do not add:
- giant charts for every market
- “insight cards” repeating the same row values
- explanatory prose that restates the table
- decorative team branding unless it helps orientation
- fake confidence narratives

---

## Phase 8 — Separate Public Product from Internal/Operator UX

### Objective

Ensure the repo has a clean product boundary.

### Public UX

Public-facing surfaces should expose:
- board
- game detail
- user preferences
- maybe watchlist/history if actually functional

### Internal UX

Internal surfaces should remain explicitly internal:
- diagnostics
- evaluation
- timeline
- snapshot controls
- calibration views
- persistence health

### Rules

Internal pages can be denser and more technical, but still must be structured and readable.

Do not leak internal terminology into the public board.

Public users do not need:
- calibration penalties
- persistence write telemetry
- debug event payloads
- internal route semantics

---

## Phase 9 — Refactor the Frontend Architecture for Consistency

### Objective

Replace ad hoc components with a deliberate system.

### Create a clear UI architecture

Add or standardize folders like:

```text
components/
  board/
  game/
  table/
  filters/
  layout/
  feedback/
  forms/
  internal/
  primitives/
```

Or equivalent under `lib/ui` if that is preferred, but make the separation explicit.

### Build component tiers

#### Tier 1: primitives
- button
- input
- select
- badge
- tabs
- table
- panel
- divider
- tooltip
- skeleton

#### Tier 2: composed product components
- BoardTable
- BoardRow
- MarketCell
- EdgeCell
- ConfidenceBadge
- BookListCell
- EventHeader
- MarketTabs
- BookComparisonTable
- DiagnosticsPanel

#### Tier 3: page-level orchestrators
- BoardView
- GameDetailView
- InternalEngineView

### Rules

- no giant page files with inline display logic everywhere
- no duplicated table logic across routes
- no repeated odds formatting helpers in multiple files
- no component that mixes fetch, transformation, and display unless truly page-level

---

## Phase 10 — Refactor Data Contracts and View Models

### Objective

Make the UI feel coherent because the data contracts are coherent.

### Introduce view-model shaping

Do not let raw backend structures leak directly into display components.

Create explicit transformers for:

- board rows
- event summaries
- comparison rows
- internal diagnostic snapshots

### Example concept

```text
lib/ui/view-models/
  boardViewModel.ts
  gameDetailViewModel.ts
  diagnosticsViewModel.ts
```

These should:

- normalize labels
- precompute display-safe values
- suppress irrelevant fields
- align null handling
- separate public and internal display concerns

### Rules

The UI should not have to guess:
- whether to show null
- whether to hide a stale number
- whether a label is long or short
- whether a metric is public-safe

Shape that upstream in view-model code.

---

## Phase 11 — Tighten Backend Product Semantics Without Breaking Core Math

### Objective

Preserve the odds engine, but improve system credibility and output clarity.

### Preserve core math

Do not alter the established fair-line pipeline without explicit rationale:
- American odds conversion
- per-book vig removal
- weighted consensus
- fair odds conversion
- EV logic
- coverage and confidence suppression

### Improve backend semantics around display

Add or normalize fields that help the UI make better decisions, for example:

- `isActionable`
- `isStale`
- `staleReason`
- `confidenceBucket`
- `coverageBucket`
- `displayRank`
- `bestBookName`
- `bestBookPrice`
- `bestPinnedBookPrice`
- `bestVsFairDelta`
- `marketStatus`
- `lastUpdatedLabel`
- `suppressionReason`

### Rules

Do not expose every intermediate internal metric publicly.
Expose:
- what the user needs
- what the UI needs
- what the product can defend

---

## Phase 12 — Add Strong Formatting Standards for Numeric Data

### Objective

Make the interface feel polished through disciplined formatting.

### Standardize all display formatting

Create a single formatting layer for:

- American odds
- decimal odds if ever needed
- percentages
- timestamps
- freshness labels
- counts
- null states
- money values if used
- model labels

### Rules

- odds should align visually
- positive odds should always include `+`
- percentages should have predictable precision
- timestamps should be compact and comparable
- null states should be intentional, for example `—`
- stale values should never look identical to live values

### Example formatting conventions

- `+110`
- `-125`
- `3.4%`
- `High`
- `Low`
- `4 books`
- `Updated 18s ago`
- `Stale`
- `—`

---

## Phase 13 — Improve Performance So the Product Feels Premium

### Objective

Make the app feel deliberate, fast, and production-safe.

### Performance priorities

1. minimize duplicate data fetches
2. ensure cache-aware server fetches
3. reduce client-side state churn
4. keep tables fast under larger result sets
5. avoid unnecessary hydration
6. stream or defer only where it materially helps
7. keep bundle size disciplined

### Required review areas

- server/client component boundaries
- redundant fetch paths
- page-level data composition
- route-level caching behavior
- internal API fan-out
- table rendering performance
- memoization only where justified
- expensive derived calculations repeated in render

### Rules

Do not hide bad architecture behind memoization.
Fix the data flow first.

---

## Phase 14 — Production Hardening Pass

### Objective

Make the repo operationally credible.

### Required hardening areas

1. **API contracts**
   - consistent response shapes
   - consistent error codes
   - public vs internal boundaries clearly enforced

2. **validation**
   - shared query validation
   - bounded params
   - safe defaults

3. **auth**
   - keep internal routes protected
   - ensure internal-only surfaces are not accidentally exposed

4. **rate limiting**
   - route-specific rate limits
   - fail-closed in production where appropriate
   - explicit fallback behavior

5. **cache strategy**
   - stale-if-error behavior where appropriate
   - honest UI signaling when cached results are shown

6. **logging**
   - structured and sparse
   - no noisy console logs
   - no secret leakage
   - production logging oriented around failures, upstream issues, and latency

7. **observability**
   - request latency
   - upstream error rate
   - cache hit ratio
   - suppression reasons
   - stale data incidence
   - rate-limit triggers

### Security reminders

Preserve the current strong foundations:
- CSP and response headers
- strict TypeScript
- no secret exposure
- protected internal routes
- trusted upstream host enforcement

---

## Phase 15 — Testing and Quality Gates for a Real Product

### Objective

Prevent regressions and force professionalism through repeatable checks.

### Required test layers

#### 1. domain math tests
Keep and expand:
- odds conversion
- vig removal
- fair probability
- fair odds
- EV
- suppression logic

#### 2. view-model tests
Add tests for:
- board row shaping
- null handling
- stale labeling
- confidence labels
- public/internal field separation

#### 3. component tests where useful
Focus on:
- table column rendering
- sorting behavior
- status badge logic
- empty/error fallback rendering

#### 4. visual regression
Expand the existing visual workflow so it validates:
- board desktop
- board compact
- game detail
- internal engine
- error states
- empty states

### Required CI quality bar

Before changes are accepted, all of the following must pass:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:visual
```

If visual testing is too expensive for every run, split it into PR-level or protected-branch workflow, but maintain it.

---

## Phase 16 — Clean Up the Repository So It Looks Deliberate

### Objective

Make the codebase itself look professionally maintained.

### Repository cleanup tasks

- remove dead components
- remove placeholder copy
- remove duplicated helpers
- remove abandoned experimental paths
- consolidate formatting utilities
- consolidate table logic
- consolidate status badge logic
- standardize folder naming
- standardize file naming
- standardize import strategy with `@/*`
- ensure README matches actual architecture and commands
- ensure AGENTS.md reflects the new UI and product rules

### Documentation to add or improve

Create or refresh:

```text
docs/
  product-principles.md
  ui-system.md
  board-spec.md
  game-detail-spec.md
  internal-surfaces.md
  api-contracts.md
  architecture.md
  production-hardening.md
```

### Documentation rule

Docs must describe what is actually true.
Do not generate aspirational docs disconnected from implementation.

---

## Phase 17 — Concrete UI Specification

### Objective

Give implementation a target that is specific enough to avoid generic design output.

## Board UI spec

### Header
Compact row containing:
- page title
- sport selector
- market selector
- sort selector
- refresh state
- optional pinned-book toggle
- optional compact mode toggle

### Controls
Dense horizontal controls or a left rail with:
- league
- market type
- model
- min books
- edge threshold
- pinned-book filter
- stale inclusion toggle

### Main table
Use a dense, professional table with:

| Event | Market | Best | Book | Fair | Edge | Confidence | Books | Updated |

Behavior:
- sticky header
- sortable columns
- row hover highlight only
- no oversized zebra striping
- compact typography
- numeric alignment
- muted metadata below event title if needed

### Row anatomy
Event cell:
- team names
- start time
- league, small and muted

Market cell:
- market type
- line value
- side/outcome

Best cell:
- best offered number
- optional pinned-book number beneath, if relevant

Fair cell:
- fair odds
- optional fair probability in secondary text only if justified

Edge cell:
- single dominant number
- optional suppression badge if hidden or downgraded

Qualification cells:
- confidence badge
- book count
- update freshness

## Game detail spec

### Top section
- teams
- start time
- market status
- best market summary
- consensus summary

### Market section
Tabbed by market type:
- moneyline
- spread
- total

### Comparison table
Columns:
| Book | Price | Line | Freshness | Notes |

### Secondary analysis section
- movement
- market pressure
- ranking rationale
- suppression reasons when relevant

### Internal-only section
Only if authorized:
- diagnostics snapshots
- calibration fields
- persistence health references

---

## Phase 18 — Anti-Slop Rules

These rules exist to stop the implementation from drifting into generic AI output.

### Never do these

- do not add a hero section to the board
- do not use gradients as a substitute for hierarchy
- do not create a wall of KPI cards
- do not use four different badge styles for similar states
- do not repeat the same metric in cards, rows, and panels
- do not use paragraphs where table structure should do the work
- do not create fake or estimated history visualizations
- do not expose internal engine jargon to public users
- do not decorate uncertainty, label it plainly
- do not generate “insights” that are just restatements of numbers
- do not overload each row with every conceivable field
- do not prioritize visual novelty over scan speed
- do not bury the best line
- do not bury the fair line
- do not bury the reason a number is suppressed
- do not leave naming inconsistent across routes, components, and labels

### Always do these

- prefer directness over cleverness
- prefer dense clarity over empty space
- prefer tables over ornamental cards
- prefer one strong number over five mediocre ones
- prefer neutral styling over trendy styling
- prefer real explanations over decorative microcopy
- prefer product truth over UI theatrics
- prefer deterministic labels over vague prose

---

## Phase 19 — Implementation Sequence

Execute in this order.

### Step 1 — Audit
Produce a repo audit covering:
- current routes
- current UI surfaces
- duplicate components
- inconsistent labels
- overloaded metrics
- dead code
- public vs internal boundary issues
- performance bottlenecks
- security-sensitive paths
- visual design inconsistencies

### Step 2 — Product spec
Write:
- board spec
- game detail spec
- internal spec
- UI token/style rules
- copy rules

### Step 3 — Data shaping
Create/normalize:
- board view models
- detail view models
- formatting layer
- status/suppression label mapping

### Step 4 — UI primitives
Standardize:
- table
- badge
- tabs
- filter controls
- panels
- skeletons
- error states

### Step 5 — Board rebuild
Rebuild the board first.
This is the primary product surface.

### Step 6 — Game detail rebuild
Build the event detail page on the same system.

### Step 7 — Internal surface cleanup
Refactor diagnostics/operator surfaces separately.

### Step 8 — Performance and hardening
Validate:
- caching
- rate limiting
- loading states
- stale fallbacks
- route consistency
- logs
- error contracts

### Step 9 — Test and visual lock
Add:
- view-model tests
- visual regression baselines
- route behavior checks

### Step 10 — Documentation pass
Refresh:
- README
- AGENTS.md
- architecture docs
- UI docs
- product docs

---

## Phase 20 — Acceptance Criteria

The overhaul is complete only when all of the following are true.

### Product quality
- the board can be scanned quickly
- the best line and fair line are obvious
- the main metrics are few and defensible
- internal data is not mixed into public UI
- copy sounds professional and restrained
- the product looks purposeful, not decorative

### Design quality
- consistent spacing, typography, color, and status logic
- tables feel premium and readable
- no generic hero/banner/dashboard-template patterns remain
- no “AI slop” phrasing remains

### Code quality
- component architecture is clear
- view models exist and reduce UI conditionals
- formatting is centralized
- dead code is removed
- file/folder organization is coherent

### Operational quality
- internal routes remain protected
- validation and rate limiting are preserved or improved
- stale/cached states are honest
- build and tests pass
- visual regression coverage exists for critical surfaces

---

## Required Output Deliverables

Produce the overhaul through these deliverables:

1. **Repo audit markdown**
2. **UI and product spec markdown**
3. **Refactor plan with file-by-file changes**
4. **Board rebuild**
5. **Game detail rebuild**
6. **Internal surface cleanup**
7. **Test additions**
8. **Docs refresh**
9. **Final QA checklist**

---

## Final Instruction

Do not optimize for “making it prettier.”

Optimize for:

- trust
- clarity
- coherence
- actionability
- production realism
- disciplined code organization
- analytical credibility

This should feel like software built by someone who understands betting workflows, interface hierarchy, and production engineering, not like a generated UI kit wrapped around odds data.
