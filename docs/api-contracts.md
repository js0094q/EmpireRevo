# API Contracts

## Public

- `/api/fair`
  - canonical fair-board JSON surface
  - bounded query validation
  - stable public error mapping

- `/api/board`
  - compatibility surface for legacy board consumers

## Internal

- Internal routes remain auth-gated and fail closed when internal auth is unavailable.

## Display contract rule

Public components consume shaped view models, not raw internal engine payloads.
