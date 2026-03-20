# EmpirePicks Security Launch Review

## 1. Title and scope

Launch hardening verification for EmpirePicks as of 2026-03-20.

Scope reviewed and remediated:
- `app/api/*`
- `app/api/internal/*`
- `app/internal/*`
- `lib/server/odds/*` security-sensitive helpers
- `proxy.ts`
- `next.config.mjs`
- security-focused tests under `tests/*`

## 2. What was fixed

| Area | Finding | Severity | Fix applied | Files changed |
|---|---|---|---|---|
| Internal access control | Internal/operator surfaces required fail-closed centralized auth with no query fallback | High | Centralized internal auth in `authorizeInternalHeaders`/`authorizeInternalRequest` using constant-time comparison; removed proxy-specific auth divergence; fail-closed `INTERNAL_AUTH_UNAVAILABLE` when key missing | `lib/server/odds/internalAuth.ts`, `proxy.ts`, `app/api/internal/diagnostics/route.ts`, `app/api/internal/evaluation/route.ts`, `app/api/internal/timeline/route.ts`, `app/api/internal/session/route.ts`, `app/internal/layout.tsx` |
| Internal UI protection | `/internal/*` pages needed non-public enforcement at render boundary | High | Added server-side internal layout gate (`unauthorized()`/`forbidden()`) before page render; proxy gate remains in place | `app/internal/layout.tsx`, `proxy.ts` |
| Public API validation | Public query parsing was route-fragmented and needed strict shared bounds | High | Shared validation utility enforced across public routes for league/sport/market/regions/books/model/format and integer bounds; invalid input returns `400 BAD_REQUEST` before upstream calls | `lib/server/odds/requestValidation.ts`, `app/api/fair/route.ts`, `app/api/board/route.ts`, `app/api/odds/route.ts` |
| Raw payload exposure | `/api/odds?format=raw` required internal-only access and bounded payload | High | Raw mode requires internal auth, returns `no-store`, enforces count limit and response byte cap | `app/api/odds/route.ts`, `lib/server/odds/internalAuth.ts` |
| `/api/fair` resiliency | Transient upstream failures could cause repeated expensive retries per request stream | Medium | Added upstream backoff + short-lived stale normalized fallback in odds service path used by `/api/fair`; preserved sanitized public error responses | `lib/server/odds/oddsService.ts`, `app/api/fair/route.ts`, `lib/server/odds/apiErrors.ts` |
| Trusted upstream control | Env override for upstream base required stricter URL hygiene | High | Enforced HTTPS-only, allowlisted hostnames, credential rejection, non-443 port rejection, canonicalized base URL | `lib/server/odds/env.ts`, `lib/server/odds/client.ts`, `app/api/status/route.ts` |
| Rate limiting degradation | Production behavior previously depended on distributed backend requirement semantics | High | Route-aware rate limiting always enforced; Upstash failures/missing config now degrade to conservative in-memory limiter; internal APIs/pages and expensive routes use tighter thresholds | `proxy.ts`, `lib/server/odds/fallbackRateLimit.ts` |
| Security headers | Global browser hardening headers needed to be enforced with functional CSP | Medium | Added global CSP and hardening headers (`nosniff`, frame protection, referrer policy, permissions policy, COOP) with dev/prod-safe script/connect directives | `next.config.mjs` |
| Error/logging hygiene | Public error responses needed stable sanitized contract | Medium | Centralized error payload contract (`{ ok:false, error:{code,message} }`) and shared mappers; no secrets or upstream bodies returned in client JSON errors | `lib/server/odds/apiErrors.ts`, `app/api/fair/route.ts`, `app/api/board/route.ts`, `app/api/odds/route.ts` |
| Security test coverage | Missing targeted launch-hardening tests | Medium | Added/updated tests for invalid query rejection, internal auth enforcement, raw mode auth, sanitized public errors, trusted upstream URL validation, and fallback limiter behavior | `tests/api-fair.test.ts`, `tests/api-odds-security.test.ts`, `tests/internalDiagnosticsRoute.test.ts`, `tests/internalSessionRoute.test.ts`, `tests/timelineRoute.test.ts`, `tests/env.test.ts`, `tests/fallbackRateLimit.test.ts` |

## 3. Current protection model

- Internal auth model:
  - `EMPIRE_INTERNAL_API_KEY` is authoritative for `/api/internal/*`, `/internal/*`, and raw odds mode.
  - Accepted credentials: `Authorization: Bearer`, `x-empire-internal-key`, or HttpOnly internal session cookie.
  - Key comparison is constant-time and fail-closed.
  - Missing key returns restricted response (`503` for API surfaces, forbidden/unauthorized page fallback for internal UI).
- Validation model:
  - Public API routes use shared validators in `lib/server/odds/requestValidation.ts`.
  - Supported sport keys are allowlisted (with optional server-side extension via `ODDS_ALLOWED_SPORT_KEYS`).
  - CSV and numeric parameters are bounded; invalid input returns `400` and does not call upstream.
- Rate-limiting model:
  - `proxy.ts` enforces route-specific limits for all `/api/*` and `/internal/*` paths.
  - Expensive routes (`/api/fair`, `/api/board`, `/api/odds?format=raw`, internal routes/pages) have stricter limits.
  - Upstash is used when configured; conservative in-memory fallback is always available and active on backend outage/missing config.
- Upstream trust model:
  - Upstream host is server-controlled and resolved through `getOddsApiBaseUrl()`.
  - Override requires HTTPS + allowlisted hostname; credentials and non-443 ports are rejected.
  - Upstream fetch uses timeout and bounded retry; client JSON never reflects upstream body text.
- Error/logging model:
  - Public API errors use stable sanitized schema from shared helpers.
  - Internal errors are sanitized and do not expose secrets or stacks.
  - No logging of env objects, auth headers, keys, cookies, or full request bodies was added.
- Browser header model:
  - Global headers enforce CSP, frame denial, MIME sniff protection, referrer policy, permissions policy, and COOP.
  - CSP keeps Next runtime functional by allowing `unsafe-eval` only outside production.
- Browser/client safety audit:
  - No `dangerouslySetInnerHTML` usage found.
  - No direct rendering of untrusted query params into raw HTML sinks.
  - Remote image allowlist remains constrained to explicit hosts in `next.config.mjs`.

## 4. Deferred items

### Intentionally deferred

None in this pass.

### Not applicable

- Stored/DOM XSS sink remediation (`dangerouslySetInnerHTML`, raw `innerHTML`): not applicable to current code paths because those sinks are not present.
- Broad remote image host tightening: not applicable; allowlist is already explicit and narrow (`a.espncdn.com`, `upload.wikimedia.org`).

## 5. Launch requirements

Required for production launch:
- `ODDS_API_KEY` (required): upstream provider API key.
- `EMPIRE_INTERNAL_API_KEY` (required when internal/operator routes are deployed): gate for `/api/internal/*`, `/internal/*`, and raw odds mode.

Recommended:
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`: distributed rate-limit consistency across instances.

Optional hardening/config:
- `ODDS_API_BASE`: upstream override (validated; invalid values are ignored).
- `ODDS_API_ALLOWED_HOSTS`: additional host allowlist entries for `ODDS_API_BASE`.
- `ODDS_ALLOWED_SPORT_KEYS`: explicit extra sport-key allowlist entries if non-default leagues are intentionally supported.

Operational rules:
- No secret env var should be exposed client-side unless intentionally prefixed as public.
- Internal routes should not be deployed without `EMPIRE_INTERNAL_API_KEY`.

## 6. Validation results

Executed on 2026-03-20:
- `npm run lint`: pass
- `npm run typecheck`: pass
- `npm test`: pass (125 tests)
- `npm run build`: pass (Next.js 16.2.0 production build)
