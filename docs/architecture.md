# EmpirePicks System Architecture

## Purpose

EmpirePicks is a quantitative sportsbook analytics platform designed to:

1. Aggregate odds from multiple sportsbooks
2. Normalize disparate book formats
3. Remove bookmaker vig
4. Compute a **consensus fair probability**
5. Convert that probability into a **fair American price**
6. Identify **positive expected value bets**
7. Present a **line-shopping interface**

The key intellectual property of the platform is the **weighted fair-odds model**, which uses sharper bookmakers to anchor probability estimates while still incorporating market breadth.

---

# Architectural Principles

## 1. Single Fair-Odds Engine

Every calculation involving:

- implied probability
- vig removal
- consensus probability
- fair odds
- EV

must run through a **single canonical implementation**.

Authoritative modules:
lib/server/odds/fairMath.ts
lib/server/odds/weights.ts
lib/server/odds/ev.ts
lib/server/odds/fairEngine.ts

No alternative implementations should exist.

---

## 2. Normalize Before Compute

External sportsbook APIs vary widely in:

- team naming
- market naming
- odds formatting
- point handling

All upstream data must be normalized before mathematical processing.
client.ts → normalize.ts → fairEngine.ts

---

## 3. One Upstream Fetch Per Request Context

Fetching odds multiple times wastes API quota and introduces race conditions.

Correct architecture:
Odds API
↓
fetchOdds()
↓
normalizeOdds()
↓
cache
↓
fairEngine
aggregator
api routes

---

# System Layers

## Layer 1: Upstream Odds Ingestion

Module:
lib/server/odds/client.ts
Responsibilities:

- Build Odds API request
- Handle timeout and retries
- Return raw JSON payload
- Fail gracefully

Example call:
GET https://api.the-odds-api.com/v4/sports/{sport}/odds

Parameters:
regions
markets
oddsFormat
apiKey

---

## Layer 2: Normalization

Module:
lib/server/odds/normalize.ts

Purpose:

Convert upstream data into stable internal schemas.

Example normalized event:
NormalizedEventOdds {
id
sportKey
commenceTime
homeTeam
awayTeam
books[]
}

---

## Layer 3: Fair Odds Engine

Module:
lib/server/odds/fairEngine.ts

Responsibilities:

1. Convert odds → probability
2. Remove vig per book
3. Apply sharp-book weighting
4. Compute consensus probability
5. Convert to fair American odds
6. Compute EV

---

## Layer 4: Aggregation Engine

Module:
lib/server/odds/aggregator.ts

Purpose:

Construct a sportsbook comparison table.

Output example:
Game
Best Line
Fair Line
Edge
EV
Books

---

## Layer 5: Movement Tracking

Module:
lib/server/odds/movement.ts

Purpose:

Track:
open
previous
current
delta

Used for UI signals like:
▲ improving
▼ worsening
⚡ rapid move

---

# Cache Layer

Production cache must use Redis.
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN

Key examples:
odds:sport:nfl
fair:board:nba
movement:eventId

TTL recommendations:
raw odds: 15s
fair board: 30s
movement history: 24h

---

# Request Lifecycle

Example `/api/fair` request:
	1.	Validate query
	2.	Check cache
	3.	Fetch upstream if needed
	4.	Normalize odds
	5.	Compute fair board
	6.	Attach movement metadata
	7.	Cache result
	8.	Return JSON

---

# UI Architecture

Server components:
page.tsx
game/[eventId]/page.tsx
games/page.tsx

Client components:
OddsBoard
GameRow
OddsCell
MovementIndicator
EdgeBadge
GameDrawer

Large tables must be virtualized.

---

# Production Requirements

Before launch:
/api/fair operational
odds math documented
Redis configured
integration tests passing

---

# Definition of Done

Architecture refactor is complete when:

- one fair math implementation exists
- upstream odds fetched once per request
- movement tracking unified
- Redis used in production
- UI uses modular components