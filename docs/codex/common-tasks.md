# Codex Common Tasks

## Add a League or Market

Start with:

```bash
rg "college_baseball|fifa_world_cup|league|sportKey|sportKeys|ODDS_ALLOWED_SPORT_KEYS" app lib tests docs README.md
```

Check:

- league type definitions
- league registry / metadata
- selector constants
- display formatting
- market support gating
- route validation
- `/api/board`
- `/api/fair`
- `/api/odds`
- `/api/internal/snapshots/collect`
- tests
- README/env documentation

## Add Provider Sport Key

Confirm the exact provider key before coding.

For The Odds API, FIFA World Cup is:

```text
soccer_fifa_world_cup
```

EmpirePicks internal league key:

```text
fifa_world_cup
```

## Add Empty State

Prefer specific, user-facing copy.

Example:

```text
No FIFA World Cup markets are currently available.
```

If league is enabled but provider returns no odds:

```text
FIFA World Cup is enabled, but no sportsbook odds are currently available from the provider.
```

## Preserve Existing Behavior

Before modifying shared helpers, check whether the change affects:

- all leagues
- props
- game board
- fair board
- internal diagnostics
- snapshots
- cached fallback behavior
