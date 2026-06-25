# EmpirePicks Agent Guide

## Scope

- Production Next.js App Router sportsbook analytics workstation.
- Preserve the existing odds, fair-line, EV, ranking, caching, diagnostics, and internal/public boundary.
- Do not treat this repo as a prototype or marketing site.

## Codex Context Shortcuts

To reduce repeated repository discovery and token usage, coding agents should read these short files before broad repo scans:

- `docs/codex/repo-map.md` - high-value paths and files to avoid touching casually
- `docs/codex/common-tasks.md` - common implementation workflows
- `docs/codex/league-market-playbook.md` - checklist for adding leagues/markets
- `docs/codex/validation-checklist.md` - standard validation and handoff format
- `docs/codex/deployment-notes.md` - Vercel/env reminders

Prefer these files before large recursive searches. Use targeted `rg` after reading them.

## Source Boundaries

- `app/`: pages, layouts, API routes, and internal/public surfaces.
- `components/`: UI components; use the nearest nested `AGENTS.md` when present.
- `lib/odds/` and `lib/server/odds/`: pricing, normalization, persistence, diagnostics, and domain logic.
- `lib/ui/`: display semantics and shared presentation helpers.
- `docs/`: product, deployment, architecture, and operational references.
- `tests/` and `scripts/`: validation and tooling.
- Generated/local artifacts such as `.next/`, `.vercel/`, `node_modules/`, `tests/visual/current/`, `tests/visual/diff/`, `.codex/`, `.DS_Store`, and `tsconfig.tsbuildinfo` are not production source.

## Commands

- Install: `npm ci`
- Dev server: `npm run dev`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Unit tests: `npm test`
- Build: `npm run build`
- Visual regression: `npm run test:visual`

Run the narrowest relevant check while iterating. Use lint, typecheck, tests, and build for shared odds, API, UI, or deployment-sensitive changes.

## Implementation Rules

- Inspect relevant source before editing.
- Keep changes narrow and reversible.
- Prefer existing helpers, view models, formatters, and components.
- Keep pricing, EV, fair-line, confidence, and formatting logic out of ad hoc UI code.
- Do not duplicate README content in agent guidance.
- Do not rename public routes, API contracts, environment variables, or persisted data shapes unless explicitly requested.
- Do not add dependencies unless necessary and justified.

## Odds and Product Semantics

- Preserve the fair-line pipeline: implied probability, vig removal, weighted consensus, fair American odds, edge, and expected value.
- Keep market price, fair value, edge, and recommendation language distinct.
- Ordinary negative EV is not a failure state; reserve danger styling for unavailable, invalid, or unsafe states.
- Internal diagnostics may expose engine detail; public surfaces should show clear market-relative product language.
- Do not fabricate odds history, outcomes, CLV, ROI, or confidence signals.

## UI Rules

- Build dense, scannable workstation UI rather than marketing sections.
- Keep the board table-first and action-oriented.
- Avoid large heroes, card mazes, decorative gradients, animation, and filler copy.
- Keep public UI concise, professional, and free of internal jargon.
- Preserve mobile readability and keyboard-accessible controls.

## Security and Operations

- Never commit secrets, `.env*`, API keys, `.vercel/`, `node_modules/`, `.next/`, caches, visual diffs, or generated artifacts.
- Keep internal routes protected by the existing auth/session boundaries.
- Do not expose operator semantics or diagnostics on public routes.
- Do not weaken rate limits, environment validation, host allowlists, cache controls, or deployment protections.
- Production deploys, Vercel changes, and GitHub pushes require explicit user instruction.
- Keep `docs/deployment.md` examples placeholder-only; never record real `ODDS_API_KEY` values.

## Testing Expectations

- Update tests when changing odds math, ranking, confidence, API behavior, security controls, or UI semantics.
- Use visual tests for material board/game/internal UI changes when practical.
- If validation cannot run, state the blocker and residual risk.

## Git and Closeout

- Do not commit, push, or deploy unless asked.
- Preserve unrelated dirty work.
- Final responses should state changed files, validation run, unvalidated areas, and any source/generated/cache boundary concerns.
