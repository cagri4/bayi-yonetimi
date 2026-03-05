---
phase: 13-production-readiness
plan: 05
subsystem: infra
tags: [sentry, error-tracking, telegram, retry, exponential-backoff, nextjs]

# Dependency graph
requires:
  - phase: 13-03
    provides: structured logger (Plan 03) — error.tsx files log via useEffect(console.error) that Sentry hooks into
provides:
  - Sentry client/server/edge error tracking with graceful DSN-absent no-op
  - Telegram message sends with 3-retry exponential backoff (1s/2s/4s)
  - withSentryConfig wrapper in next.config.ts
affects:
  - 13-06

# Tech tracking
tech-stack:
  added: ["@sentry/nextjs 10.42.0"]
  patterns:
    - "Sentry integration: enabled: !!dsn guard for graceful no-op when DSN absent"
    - "Telegram retry: sendWithRetry() wraps fetch calls — 4xx non-retryable, 429 uses Retry-After header"

key-files:
  created:
    - sentry.client.config.ts
    - sentry.server.config.ts
    - sentry.edge.config.ts
  modified:
    - next.config.ts
    - src/lib/agents/dispatcher.ts
    - src/lib/env.ts
    - .env.example

key-decisions:
  - "NEXT_PUBLIC_SENTRY_DSN used in sentry.client.config.ts (browser-exposed), SENTRY_DSN for server/edge — two separate env vars for two scopes"
  - "withSentryConfig options: silent=true, hideSourceMaps=true, disableLogger=true — clean CI logs, no source map leakage, smaller bundle"
  - "SENTRY_ORG/SENTRY_PROJECT passed via process.env in next.config.ts, not hardcoded — avoids org/project name in source"
  - "sendWithRetry() is an internal helper; sendTelegramMessage() preserves its original signature — callers unchanged"
  - "4xx errors (except 429) return immediately without retry — permanent failures (bad token, wrong chat_id) should not retry"

patterns-established:
  - "Retry helper pattern: separate attemptXxx() single-attempt fn + sendWithRetry() loop — clean separation of concerns"
  - "Sentry graceful degradation: enabled: !!process.env.SENTRY_DSN — zero runtime overhead when DSN not configured"

requirements-completed: [P1-SENTRY, P2-RETRY]

# Metrics
duration: 12min
completed: 2026-03-05
---

# Phase 13 Plan 05: Sentry Error Tracking and Telegram Retry Summary

**@sentry/nextjs integrated for client/server/edge error tracking, Telegram sends upgraded with 3-retry exponential backoff (1s/2s/4s) with 429 rate-limit awareness**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-05T09:04:57Z
- **Completed:** 2026-03-05T09:17:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Installed @sentry/nextjs 10.42.0 and created three Sentry config files at project root (client, server, edge)
- Wrapped next.config.ts with withSentryConfig (hideSourceMaps, disableLogger, silent)
- Added NEXT_PUBLIC_SENTRY_DSN and SENTRY_DSN to env.ts Zod schema as optional strings; updated .env.example with all Sentry env var documentation
- Refactored sendTelegramMessage in dispatcher.ts to use sendWithRetry() with exponential backoff — 4xx non-retryable, 429 respects Retry-After header, network errors retry with backoff

## Task Commits

Each task was committed atomically:

1. **Task 1: Integrate Sentry for error tracking** - `0f6bd44` (feat)
2. **Task 2: Add exponential backoff retry to Telegram sends** - `cd2a538` (feat)

**Plan metadata:** (docs commit pending)

## Files Created/Modified
- `sentry.client.config.ts` - Client-side Sentry init with NEXT_PUBLIC_SENTRY_DSN, enabled guard
- `sentry.server.config.ts` - Server-side Sentry init with SENTRY_DSN, enabled guard
- `sentry.edge.config.ts` - Edge runtime Sentry init with SENTRY_DSN, enabled guard
- `next.config.ts` - Wrapped with withSentryConfig (hideSourceMaps, disableLogger, silent)
- `src/lib/agents/dispatcher.ts` - sendWithRetry() with exponential backoff replacing direct fetch
- `src/lib/env.ts` - Added SENTRY_DSN and NEXT_PUBLIC_SENTRY_DSN as optional Zod fields (server + public schemas)
- `.env.example` - Added SENTRY_DSN, NEXT_PUBLIC_SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN with documentation

## Decisions Made
- NEXT_PUBLIC_SENTRY_DSN used in sentry.client.config.ts (browser-exposed), SENTRY_DSN for server/edge — two separate env vars for two scopes (client bundle vs server code)
- withSentryConfig options: silent=true (clean CI), hideSourceMaps=true (no source leak), disableLogger=true (smaller bundle)
- SENTRY_ORG/SENTRY_PROJECT set via process.env in next.config.ts — avoids org/project names hardcoded in source
- sendWithRetry() is an internal helper; sendTelegramMessage() preserves its original public signature — all callers unchanged
- 4xx errors (except 429) fail immediately — permanent failures like bad token or wrong chat_id should not waste retries

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None — TypeScript check passed on first run for both tasks.

## User Setup Required
External services require manual configuration for Sentry error tracking:

1. Create a Sentry account at https://sentry.io (or use existing org)
2. Create a new project: Sentry Dashboard -> Projects -> Create Project -> Next.js
3. Get DSN: Settings -> Client Keys -> DSN
4. Get auth token: Settings -> Auth Tokens -> Create New (for source map uploads)
5. Add to Vercel env vars:
   - `SENTRY_DSN` — server/edge DSN
   - `NEXT_PUBLIC_SENTRY_DSN` — client DSN (same value as SENTRY_DSN typically)
   - `SENTRY_ORG` — your Sentry org slug
   - `SENTRY_PROJECT` — your Sentry project slug
   - `SENTRY_AUTH_TOKEN` — auth token for source map uploads

App works identically when these vars are not set — Sentry is a no-op.

## Next Phase Readiness
- Sentry integration complete — once DSN is added to Vercel, errors from all three runtimes (client, server, edge) will be captured
- Telegram retry logic active immediately — no configuration required; runs in background via after()
- Plan 06 (Vitest) can proceed — no dependencies on Sentry

## Self-Check: PASSED

- sentry.client.config.ts: FOUND
- sentry.server.config.ts: FOUND
- sentry.edge.config.ts: FOUND
- next.config.ts (withSentryConfig): FOUND
- src/lib/agents/dispatcher.ts (sendWithRetry): FOUND
- Task 1 commit 0f6bd44: FOUND
- Task 2 commit cd2a538: FOUND

---
*Phase: 13-production-readiness*
*Completed: 2026-03-05*
