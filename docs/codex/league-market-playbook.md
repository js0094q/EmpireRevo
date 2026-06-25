# League and Market Extension Playbook

Use this checklist when adding a new league, tournament, or market.

## 1. Define Canonical Keys

Each league should have:

| Field | Example |
|---|---|
| internal league key | `fifa_world_cup` |
| provider sport key | `soccer_fifa_world_cup` |
| display label | `FIFA World Cup` |
| short label | `World Cup` |
| sport group | `Soccer` |

## 2. Update Registry and Types

Find and update existing sources of truth. Do not create a parallel registry unless the app already has that pattern.

Typical areas:

- league union/type
- sport/league registry
- selector options
- market support map
- display name formatter
- route validation allowlist

## 3. Update APIs

The new league should work anywhere existing leagues work:

```text
/api/board?league=<league>
/api/fair?league=<league>
/api/odds?league=<league>
/api/internal/snapshots/collect?sportKeys=<providerSportKey>
```

If the API supports direct sport keys, also support:

```text
/api/board?sportKey=<providerSportKey>
```

## 4. Update UI

The selector should show the league in the correct group.

For FIFA World Cup:

```text
Soccer -> FIFA World Cup
```

## 5. Update Docs

Update:

- `README.md`
- deployment notes if env vars are affected
- security/threat docs only if new exposure or route behavior changes

## 6. Add Tests

Minimum useful tests:

- internal key maps to provider sport key
- provider sport key is accepted
- malformed key is rejected
- selector includes display label
- empty state renders
- APIs parse the league query

## 7. Validate

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

Run visual regression only if UI layout or snapshots changed:

```bash
npm run test:visual
```
