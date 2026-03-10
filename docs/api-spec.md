# EmpirePicks API Specification

All API routes return JSON and run server-side only.

## Error Format

{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Description"
  }
}

## GET /api/health

Purpose: Environment and configuration check.

Response:

{
  "ok": true,
  "oddsApiConfigured": true,
  "cacheProvider": "redis"
}

## GET /api/status

Operational diagnostics.

Response:

{
  "ok": true,
  "uptimeSec": 12345,
  "cache": {
    "provider": "redis",
    "reachable": true
  }
}

## GET /api/odds

Returns normalized odds.

Query parameters:
sportKey (required)
market
regions
format

## GET /api/fair

Returns fair‑odds board.

Query parameters:

sportKey
market (h2h | spreads | totals)
model
regions
minBooks

Example response:

{
  "ok": true,
  "generatedAt": 1770000000000,
  "sportKey": "basketball_nba",
  "events": []
}

## HTTP Status Codes

200 success
400 invalid query
404 not found
500 server error
502 upstream failure
504 upstream timeout