
# EmpirePicks — Agent Instructions

This document provides instructions for AI coding agents (Codex, Cursor, Copilot Agents, etc.) working on the EmpirePicks repository.

EmpirePicks is a **sports odds aggregation and betting analytics platform**.

Agents must follow these rules when analyzing or modifying the codebase.

---

# 1. Project Overview

EmpirePicks aggregates sportsbook odds and computes **fair market probabilities** using multiple books.

Primary goals:

1. Aggregate odds from multiple sportsbooks
2. Remove bookmaker vig
3. Calculate weighted fair probability
4. Display expected value (EV)
5. Provide line shopping across sportsbooks

The product should resemble professional betting tools such as:

- OddsTrader
- OddsJam
- Unabated
- Action Network

The UI should prioritize **clarity, speed, and analytical insight.**

---

# 2. Tech Stack

Frontend
- Next.js (App Router)
- React
- TypeScript
- Tailwind

Backend
- Next.js API routes
- Node.js runtime
- Odds API integration

Infrastructure
- Vercel deployment
- Optional Upstash Redis cache/persistence

Agents must maintain compatibility with:

Node >= 20

---

# 3. Repository Structure

Agents should understand the repository layout before making changes.

app/
api/ # Next.js API routes
games/ # game listings
components/ # UI components

lib/
server/
odds/ # odds math and aggregation
utils/

scripts/
setup.sh

public/
assets/

Important logic lives in:

lib/server/odds/

Agents must review this folder carefully before modifying odds calculations.

---

# 4. Development Setup

To run the project locally:

npm install
npm run dev

Observed helper workflow:

bash scripts/setup.sh

Development server:

http://localhost:3000

Before submitting changes agents must verify:

npm run lint
npm run typecheck
npm test
npm run build

---

# 5. Core Domain Logic

EmpirePicks revolves around **odds mathematics**.

Agents must preserve the exact backend computation pipeline defined below.

---

## Step 1 — Convert American Odds to Implied Probability

\[
P =
\begin{cases}
\frac{100}{\text{Odds} + 100}, & \text{Odds} > 0 \\
\\
\frac{|\text{Odds}|}{|\text{Odds}| + 100}, & \text{Odds} < 0
\end{cases}
\]

If odds are non-finite or \( = 0 \):
\[
P = 0
\]

---

## Step 2 — Remove Vig (Per Book, Per Market Pair)

\[
P_i^{\text{no vig}} = \frac{P_i^{\text{raw}}}{\sum_j P_j^{\text{raw}}}
\]

If total is invalid:
\[
\sum_j P_j^{\text{raw}} \le 0 \;\Rightarrow\; P_i^{\text{no vig}} = \frac{1}{N}
\]

---

## Step 3 — Apply Book Weights (Expanded Universe)

Each sportsbook \( i \) is assigned a weight \( w_i \) based on signal quality.

### Tier 1 — Sharp / Market-Making Books

\[
w_{\text{Pinnacle}} = 1.0,\quad
w_{\text{Circa}} = 0.9,\quad
w_{\text{Bookmaker}} = 0.85,\quad
w_{\text{BetCris}} = 0.85
\]

---

### Tier 2 — Strong Signal / Hybrid Books

\[
w_{\text{BetOnline}} = 0.75,\quad
w_{\text{Heritage}} = 0.7,\quad
w_{\text{LowVig}} = 0.7
\]

---

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

---

### Tier 4 — Recreational / Promotional Books

\[
w_{\text{BetRivers}} = 0.28,\quad
w_{\text{Unibet}} = 0.28,\quad
w_{\text{WynnBet}} = 0.26,\quad
w_{\text{FOXBet}} = 0.25,\quad
w_{\text{SuperBook}} = 0.25
\]

---

### Tier 5 — Exchange / Niche / Regional

\[
w_{\text{Matchbook}} = 0.6,\quad
w_{\text{BetfairExchange}} = 0.6,\quad
w_{\text{Smarkets}} = 0.6
\]

---

### Fallback (Unknown Books)

\[
w_{\text{unknown}} = 0.12
\]

---

### Model Overrides

- **weighted (default)** → use weights above  
- **sharp** → restrict to Tier 1  
- **equal**:
\[
w_i = 1 \quad \forall i
\]

---

## Step 4 — Calculate Fair Probability

\[
P_{\text{fair}} =
\frac{\sum_i w_i \cdot P_i^{\text{no vig}}}{\sum_i w_i}
\]

If total weight is invalid:
\[
P_{\text{fair}} = 0.5
\]

---

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

---

## Step 6 — Expected Value (EV)

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

---

## Runtime Constraints

- Markets grouped by identical line values (spreads/totals)
- Fair price computed within each group
- EV may be suppressed when:
\[
\text{coverage} \;\text{or}\; \text{confidence thresholds fail}
\]

---

## API Defaults

\[
\text{/api/fair: model} = \text{weighted}, \quad \text{minBooks} = 4
\]

Indicates a mathematically favorable bet.

---

# 6. Agents must comment any EV math changes.

---

# 7. Line Shopping Logic

Users should be able to compare sportsbooks.

For each game:

Display

Game
Best Odds
Sportsbook prices
Fair odds
EV

Example:

Penguins vs Bruins

Book        Odds
FanDuel     +110
DraftKings  +105
Caesars     +108

Best Price: +110
Fair Price: +102
EV: +3.4%

---

# 8. UI Principles

Agents must prioritize:

Clarity  
Low cognitive load  
Data density

Avoid:

- large hero banners
- excessive animations
- heavy gradients

Preferred UI patterns:

Sportsbook dashboards  
Financial trading dashboards  

Tables are preferred over cards.

---

# 9. Performance Requirements

Agents should minimize:

- duplicate API calls
- unnecessary server renders
- large client bundles

Preferred solutions:

- API caching
- Redis odds snapshots
- incremental updates

---

# 10. Error Handling

API failures must not break the UI.

Agents should implement:

try/catch blocks
fallback data
loading states

If odds API fails:

Return cached data if available.

---

# 11. Security Rules

Agents must NEVER:

- expose API keys
- log environment variables
- commit `.env` files

All secrets must be stored in:

.env.local

---

# 12. Coding Standards

TypeScript strict mode required.

Rules:

- no `any` types
- prefer functional components
- explicit return types

Naming conventions:

camelCase → variables
PascalCase → React components
kebab-case → routes

---

# 13. Testing Expectations

Agents should create tests for:

- odds conversion
- vig removal
- EV calculations

Testing framework:

Node's built-in test runner via `tsx --test` (`npm test`)

Visual regression workflow:

- `npm run test:visual`
- `npm run test:visual -- --update` to refresh baselines

---

# 14. Commit Guidelines

Agents should produce commits formatted as:

feat: add fair odds calculation
fix: correct vig removal logic
refactor: improve odds engine structure

Avoid vague messages.

---

# 15. Deployment

Production environment:

Vercel

Build command:

npm run build

Agents must ensure builds succeed before merging changes.

---

# 16. Agent Guardrails

Agents must NOT:

- rewrite the entire UI
- remove odds math logic
- change API schemas without reason

Agents SHOULD:

- make minimal changes
- document reasoning
- maintain backwards compatibility

---

# 17. Future Roadmap

Potential features:

- line movement tracking
- steam move alerts
- CLV tracking
- sharp vs public indicators
- player prop analytics

Agents may propose improvements but should not implement large features without instruction.

---

# End of AGENTS.md
