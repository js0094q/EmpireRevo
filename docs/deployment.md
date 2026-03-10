# EmpirePicks Deployment Guide

## Runtime Requirements

Node.js 20+
Next.js
Redis for caching

## Required Environment Variables

ODDS_API_KEY

Recommended:

UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN

Optional:

NEXT_PUBLIC_DEFAULT_LEAGUE

## Local Setup

Install dependencies

npm ci

Create `.env.local`

ODDS_API_KEY='00547f8163741cb20868cbde64f44117'

Start dev server

npm run dev

## Vercel Deployment

Build command:

npm run build

Environment variables must be configured in the Vercel dashboard.

## Production Checklist

- Redis configured
- Rate limiting enabled
- `/api/fair` functional
- Integration tests passing
- No exposed secrets

## Cache TTL Recommendations

Raw odds: 15 seconds
Fair board: 15–30 seconds
Aggregated board: 15–30 seconds

## Post Deploy Checks

1. Homepage loads
2. `/games` renders
3. `/api/health` returns success
4. `/api/status` reports healthy services