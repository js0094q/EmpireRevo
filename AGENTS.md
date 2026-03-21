
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
- Optional Redis cache

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

Development server:

http://localhost:3000

Before submitting changes agents must verify:

npm run lint
npm run typecheck
npm run build

---

# 5. Core Domain Logic

EmpirePicks revolves around **odds mathematics**.

Agents must preserve the following workflow:

### Step 1 — Convert American Odds to Probability

Example:

+150 → 40%  
-150 → 60%

### Step 2 — Remove Vig

If sportsbook shows:

Team A  -110  
Team B  -110

Implied probabilities exceed 100%.

Normalize probabilities so:

P(A) + P(B) = 1

### Step 3 — Apply Book Weights

Sharp books should be weighted higher.

Example weighting:

Pinnacle: 1.5
Circa: 1.5
DraftKings: 1.0
FanDuel: 1.0
Caesars: 0.9

### Step 4 — Calculate Fair Probability

Weighted average of probabilities.

### Step 5 — Convert Back to Odds

Fair probability → American odds.

---

# 6. Expected Value Calculation

EV should be calculated as:

EV = (Fair Probability * Decimal Odds) - 1

Positive EV indicates value.

Agents must comment any EV math changes.

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

Vitest or Jest

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
