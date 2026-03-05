---
phase: 13-production-readiness
plan: 03
subsystem: infra
tags: [rate-limiting, logging, middleware, edge-runtime, request-id]

# Dependency graph
requires:
  - phase: 12-agent-ecosystem
    provides: Telegram webhook routes at /api/telegram/{role}/ that need rate limiting
provides:
  - In-memory sliding window rate limiter (apiLimiter, telegramLimiter, cronLimiter)
  - Structured JSON logger with request ID correlation support
  - Request ID (x-request-id) header on every HTTP response
  - 429 rate limiting on all /api/ routes with Retry-After header
affects: [14-tenant-onboarding, any-phase-adding-api-routes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Sliding window rate limiter using Map<string, { count, resetAt }> — Edge runtime compatible, resets on cold start
    - Structured JSON logging via console.log(JSON.stringify(entry)) — Vercel log drain compatible
    - Request ID via crypto.randomUUID() in middleware — propagated through all response code paths

key-files:
  created:
    - src/lib/rate-limit.ts
    - src/lib/logger.ts
  modified:
    - src/middleware.ts

key-decisions:
  - "request.ip removed — not available on NextRequest in Next.js 16; IP sourced from x-forwarded-for header only"
  - "Rate limit logic for /api/ routes runs before updateSession() auth check — avoids unnecessary Supabase auth round-trip on blocked requests"
  - "logger.ts NOT imported in middleware — Edge runtime safe; logger is for API route and server-side use only"
  - "cleanup() called on every rate-limited request but only executes every 60s (lastCleanup guard) — avoids per-request Map scan"

patterns-established:
  - "Rate limit key = IP from x-forwarded-for (first address in chain)"
  - "All redirect responses set x-request-id header — consistent header on every response type"
  - "Per-route-group limiters: /api/telegram/* 30/min, /api/cron/* 5/min, /api/* 60/min"

requirements-completed: [P0-RATELIMIT, P0-LOGGING]

# Metrics
duration: 4min
completed: 2026-03-05
---

# Phase 13 Plan 03: Rate Limiting and Structured Logging Summary

**In-memory sliding window rate limiter (30/60/5 req/min per route group) and JSON structured logger with x-request-id correlation on every HTTP response**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-05T08:55:42Z
- **Completed:** 2026-03-05T08:59:43Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created `src/lib/rate-limit.ts` with RateLimiter class and 3 pre-configured instances (api/telegram/cron) compatible with Vercel Edge runtime
- Created `src/lib/logger.ts` with JSON structured output, createLogger factory, and default logger export for request ID correlation
- Updated `src/middleware.ts` to generate crypto.randomUUID() x-request-id on every request and enforce rate limits on all /api/ routes with 429 + Retry-After responses

## Task Commits

Each task was committed atomically:

1. **Task 1: Create rate limiter and structured logger** - `945671d` (feat)
2. **Task 2: Update middleware for request ID and rate limiting** - `b6ae7e7` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/lib/rate-limit.ts` - Sliding window RateLimiter class; exports apiLimiter (60/min), telegramLimiter (30/min), cronLimiter (5/min)
- `src/lib/logger.ts` - Structured JSON logger; exports createLogger(context) factory and default logger instance
- `src/middleware.ts` - Added request ID generation, per-route-group rate limiting, x-request-id on all response types

## Decisions Made
- `request.ip` was removed from `NextRequest` in Next.js 16 — IP sourced from `x-forwarded-for` header only
- Rate limiting for `/api/` routes runs before `updateSession()` call — avoids unnecessary Supabase auth round-trip on blocked requests; allowed API requests still call `updateSession()` and get full supabase session response
- Logger not imported in middleware (Edge runtime safe) — API routes and server actions can use createLogger for structured request-scoped logging

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed request.ip — property does not exist on NextRequest**
- **Found during:** Task 2 (Update middleware for request ID and rate limiting)
- **Issue:** Plan specified `request.ip || 'unknown'` fallback but `request.ip` was removed from `NextRequest` type in Next.js 16, causing TS2339 compile error
- **Fix:** Removed `request.ip` fallback; IP sourced exclusively from `x-forwarded-for` header (already the primary source per plan); fallback to `'unknown'`
- **Files modified:** src/middleware.ts
- **Verification:** `npx tsc --noEmit` passes with zero errors
- **Committed in:** b6ae7e7 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — outdated API reference in plan)
**Impact on plan:** Minor fix, no behavior change (x-forwarded-for was already the primary IP source). No scope creep.

## Issues Encountered
None beyond the auto-fixed TypeScript compile error.

## User Setup Required
None - no external service configuration required. Rate limiting is in-memory (resets on cold start). Logger outputs to console (Vercel captures automatically).

## Next Phase Readiness
- Rate limiting protects all 15 API endpoints including 12 Telegram webhook routes
- x-request-id header propagated on all responses enables log correlation
- `createLogger` available for API routes to add structured request-scoped logging
- Ready for Plan 04 (next production readiness plan)

---
*Phase: 13-production-readiness*
*Completed: 2026-03-05*

## Self-Check: PASSED
- FOUND: src/lib/rate-limit.ts
- FOUND: src/lib/logger.ts
- FOUND: src/middleware.ts
- FOUND: 13-03-SUMMARY.md
- FOUND commit: 945671d (Task 1)
- FOUND commit: b6ae7e7 (Task 2)
