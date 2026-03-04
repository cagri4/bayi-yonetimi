---
phase: 12-extended-agent-ecosystem
plan: "07"
subsystem: infra
tags: [vercel-cron, telegram, cron-job, proactive-briefing, tahsilat-uzmani]

# Dependency graph
requires:
  - phase: 12-05
    provides: handler-factory.ts and real callAgent() — dispatcher fully operational
  - phase: 12-06
    provides: 7 webhook routes + agent_definitions seed — all Phase 12 agents deployed
provides:
  - Vercel Cron configuration (vercel.json) scheduling daily briefing at 08:00 UTC
  - GET /api/cron/daily-briefing endpoint — CRON_SECRET-authenticated proactive briefing
  - Multi-tenant loop over companies with active tahsilat_uzmani agent definitions
  - Overdue payment count and total queried via dealer join (no company_id on dealer_transactions)
  - Telegram message delivery to enrolled dealers (those with telegram_chat_id set)
affects:
  - future proactive briefing expansion (other agent roles, more briefing types)
  - Vercel deployment cron tab visibility

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vercel Cron: vercel.json crons array with once-per-day limit (Hobby plan — 0 8 * * *)"
    - "Cron auth: Authorization: Bearer {CRON_SECRET} header check — no user session needed"
    - "Proactive messaging: cron fires independently of user input — agents initiate conversations"
    - "Multi-tenant cron loop: queries agent_definitions per company, sends to enrolled dealers only"

key-files:
  created:
    - vercel.json
    - src/app/api/cron/daily-briefing/route.ts
  modified:
    - src/middleware.ts

key-decisions:
  - "CRON_SECRET header auth (not query param) — Vercel injects header automatically when calling cron routes"
  - "overdue scope via dealer_id IN (...) join — dealer_transactions has no company_id column (same constraint as Phase 11 muhasebeci)"
  - "Middleware fix: /api/ routes excluded from auth redirect — cron route would 302-redirect without Bearer header otherwise"
  - "briefingsSent counter returned in JSON response — enables manual test verification without Telegram bot configured"

patterns-established:
  - "Cron pattern: force-dynamic export, CRON_SECRET check first, try/catch with briefingsSent counter, Response.json({ success, briefingsSent })"
  - "Proactive agent pattern: cron queries agent_definitions for role, loops companies, delivers one message per enrolled dealer"

requirements-completed: [AO-03]

# Metrics
duration: 45min (including checkpoint wait)
completed: 2026-03-04
---

# Phase 12 Plan 07: Daily Briefing Cron Summary

**Vercel Cron at 08:00 UTC delivers Tahsilat Uzmani overdue payment briefings to enrolled dealers via Telegram, closing the proactive agent loop for Phase 12.**

## Performance

- **Duration:** ~45 min (including human checkpoint for CRON_SECRET setup and live endpoint verification)
- **Started:** 2026-03-04
- **Completed:** 2026-03-04
- **Tasks:** 2 (Task 1: create files, Task 2: checkpoint verification)
- **Files modified:** 3

## Accomplishments

- vercel.json created with cron at `0 8 * * *` pointing to `/api/cron/daily-briefing` — Hobby plan compliant
- `GET /api/cron/daily-briefing` route returns 401 without CRON_SECRET, 200 JSON with valid CRON_SECRET
- Multi-tenant loop queries `agent_definitions` for active `tahsilat_uzmani` agents, then enrolled dealers (`telegram_chat_id NOT NULL`), then overdue transactions scoped via dealer join
- Middleware fixed to exclude `/api/` routes from auth redirect — prevents cron route 302-redirect on unauthenticated cron calls
- Live endpoint verified on Vercel: `{"success":true,"briefingsSent":0}` with valid CRON_SECRET header

## Task Commits

Each task was committed atomically:

1. **Task 1: Create vercel.json and daily-briefing route** - `063e553` (feat)
2. **Fix: Middleware exclude /api/ routes from auth redirect** - `d02a1e7` (fix)
3. **Task 2: Checkpoint — CRON_SECRET set and endpoint verified** - no code commit (human verification step, checkpoint resolved by user confirmation)

## Files Created/Modified

- `vercel.json` - Vercel Cron config: daily briefing at `0 8 * * *`
- `src/app/api/cron/daily-briefing/route.ts` - GET endpoint with CRON_SECRET auth, multi-tenant briefing loop, overdue payment query via dealer join, Telegram sendMessage delivery
- `src/middleware.ts` - Added `/api/` path exclusion to prevent auth redirect intercepting cron and webhook routes

## Decisions Made

- CRON_SECRET header auth used instead of query param — Vercel automatically injects the `Authorization: Bearer` header when calling cron routes, and it avoids leaking the secret in server logs
- Overdue transactions scoped via `dealer_id IN (dealerIds)` not `company_id` — `dealer_transactions` has no `company_id` column, consistent with Phase 11 muhasebeci-tools decision
- Middleware exclusion for `/api/` routes was a blocking deviation (Rule 3) — without it, the cron route returned 302 redirect instead of 401/200

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Middleware auth redirect intercepting cron route**
- **Found during:** Task 2 (checkpoint verification)
- **Issue:** Next.js middleware was redirecting all unauthenticated requests (including the cron endpoint) to `/login`, causing the cron route to return 302 instead of 401 or 200
- **Fix:** Added `/api/` path prefix to middleware exclusion list in `src/middleware.ts`
- **Files modified:** `src/middleware.ts`
- **Verification:** Live endpoint confirmed returning 401 (no token) and 200 (valid CRON_SECRET)
- **Committed in:** `d02a1e7`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required fix — without it the cron endpoint was unreachable. No scope creep.

## Issues Encountered

- Middleware was intercepting `/api/cron/daily-briefing` before the route handler could check the CRON_SECRET header, causing 302 redirect. Fixed by excluding `/api/` from middleware auth checks.

## User Setup Required

- CRON_SECRET env var must be set in Vercel Dashboard -> bayi-yonetimi -> Settings -> Environment Variables
- User confirmed this was completed and endpoint verified live

## Next Phase Readiness

- Phase 12 is now fully complete — all 7 plans executed
- Proactive agent briefings are live: agents now initiate conversations, not just respond
- Future expansion: add more agent roles to the daily briefing cron loop (e.g., depo_sorumlusu low-stock alerts, satin_alma pending PO reminders)
- No blockers

---
*Phase: 12-extended-agent-ecosystem*
*Completed: 2026-03-04*
