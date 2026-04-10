# Production Hardening

## Preserved

- strict TypeScript
- CSP and response headers
- bounded request validation
- protected internal routes
- trusted upstream host enforcement

## Applied in overhaul

- removed game-detail render-time persistence writes
- kept public/internal boundaries explicit
- added sober public error states
- expanded view-model coverage and visual regression targets
- added `allowedDevOrigins` for local visual automation against `127.0.0.1`
