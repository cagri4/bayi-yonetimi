---
phase: 16-kurulum-sihirbazi
plan: 02
subsystem: api
tags: [telegram, fsm, wizard, onboarding, dispatcher, webhook]

# Dependency graph
requires:
  - phase: 16-01
    provides: "loadOrCreateSession, handleStep, updateSession, WizardSession type — all FSM core modules"
  - phase: 15-company-creation-infrastructure
    provides: "sihirbaz webhook route with idempotency, sendTelegramMessage, createServiceClient"
provides:
  - "dispatchSihirbazUpdate: main entry point for sihirbaz Telegram update processing"
  - "Wired webhook route: after() calls dispatchSihirbazUpdate, Phase 15 stub replaced"
  - "Terminal state guards: null session, completed, expired handled in dispatcher before handleStep"
affects: [16-03-PLAN.md, sihirbaz-e2e-testing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dispatcher pattern: single dispatchSihirbazUpdate function bridges webhook route and FSM"
    - "Terminal state pre-checks in dispatcher — handleStep only called for active sessions"
    - "BOT_TOKEN at dispatcher level (not route) — dispatcher owns Telegram credential"
    - "Error catch in dispatcher sends Turkish user-facing message + logs to console"

key-files:
  created:
    - src/lib/sihirbaz/dispatcher.ts
  modified:
    - src/app/api/telegram/sihirbaz/route.ts

key-decisions:
  - "BOT_TOKEN read by dispatcher (not route) — consistent with Plan 01 handleStep signature that already accepts botToken param; route is token-agnostic"
  - "Dispatcher handles null session with two distinct Turkish messages: /start gets 'invalid token' message, non-/start gets 'need invite link' message — better UX than single generic rejection"
  - "Terminal state checks (completed, expired) in dispatcher before handleStep — prevents handleStep from needing to guard these states redundantly"
  - "Error catch block in dispatchSihirbazUpdate sends Turkish user-facing error message AND logs to console — user never sees silent failure"

patterns-established:
  - "Webhook -> idempotency -> after() -> dispatchSihirbazUpdate -> loadOrCreateSession -> handleStep — complete wired flow"
  - "route.ts after() callback is a single try/catch wrapping dispatchSihirbazUpdate(update) — no business logic in route"

requirements-completed: [KS-01, KS-07]

# Metrics
duration: 8min
completed: 2026-03-06
---

# Phase 16 Plan 02: Kurulum Sihirbazi Dispatcher Wiring Summary

**Telegram webhook -> FSM dispatcher wired: dispatchSihirbazUpdate connects the sihirbaz webhook route to the Phase 01 FSM core, replacing the Phase 15 stub with the complete session-load + step-dispatch pipeline**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-06T13:10:00Z
- **Completed:** 2026-03-06T13:18:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `dispatcher.ts`: `dispatchSihirbazUpdate` entry point created — extracts message text, loads/creates session, guards terminal states (null/completed/expired), delegates to `handleStep`
- `route.ts`: Phase 15 placeholder stub replaced — `after()` callback now calls `dispatchSihirbazUpdate(update)` in a single try/catch; `botToken` constant removed from route
- `pnpm build` passes with exit code 0; `/api/telegram/sihirbaz` confirmed in build output

## Task Commits

Each task was committed atomically:

1. **Task 1: Create wizard dispatcher module** - `0bb4767` (feat)
2. **Task 2: Wire dispatcher into sihirbaz webhook route** - `3af9dc4` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/lib/sihirbaz/dispatcher.ts` - Main entry point for sihirbaz wizard update processing; imports loadOrCreateSession + handleStep from Plan 01 FSM modules
- `src/app/api/telegram/sihirbaz/route.ts` - Phase 15 stub replaced; after() now calls dispatchSihirbazUpdate(update); botToken constant removed

## Decisions Made

- **BOT_TOKEN ownership at dispatcher level:** The dispatcher reads `TELEGRAM_BOT_TOKEN_SIHIRBAZ` directly rather than receiving it from the route. This is consistent with Plan 01's `handleStep(supabase, session, chatId, text, botToken)` signature — the dispatcher is the caller that supplies the token. The route becomes token-agnostic.
- **Two distinct null-session messages:** When session is null, the dispatcher sends different Turkish messages for `/start` vs non-`/start` cases. `/start` with invalid token gets "Bu davet linki artik gecerli degil" (token-specific rejection). Non-`/start` from unknown user gets "Merhaba! Sisteme kayit olmak icin bir davet linkine ihtiyaciniz var" (helpful explanation). Better UX than a single generic rejection.
- **Terminal state checks before handleStep:** `completed` and `expired` states are handled in the dispatcher, not handleStep. This keeps handleStep focused on active session transitions and avoids redundant guard logic in both dispatcher and step handler.
- **Error handling sends Turkish user message:** The catch block in `dispatchSihirbazUpdate` sends "Bir hata olustu. Lutfen tekrar deneyin." to the user so they know something went wrong, while also logging the raw error to console for debugging.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. TypeScript compilation clean on first pass. `pnpm build` passed without errors.

## User Setup Required

None - no external service configuration required. The dispatcher reads `TELEGRAM_BOT_TOKEN_SIHIRBAZ` which was already added to Vercel env vars in Phase 15.

## Next Phase Readiness

The complete wizard flow is wired end-to-end:
- Telegram delivers update to `/api/telegram/sihirbaz`
- Route performs idempotency check and returns 200
- `after()` callback invokes `dispatchSihirbazUpdate(update)`
- Dispatcher loads/creates session and delegates to `handleStep`
- Step handlers advance the FSM through 7 steps to provisioning completion

Phase 16 Plan 03 (if any) or Phase 17 (Billing + Trial) can proceed. The wizard is fully functional and will activate as soon as `TELEGRAM_BOT_TOKEN_SIHIRBAZ` is set and the webhook URL is registered with Telegram.

---
*Phase: 16-kurulum-sihirbazi*
*Completed: 2026-03-06*
