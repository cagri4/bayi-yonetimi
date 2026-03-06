---
phase: 15-company-creation-infrastructure
plan: 02
subsystem: ui
tags: [superadmin, nextjs, react, server-actions, telegram, webhook, idempotency]

# Dependency graph
requires:
  - phase: 15-01
    provides: createCompany Server Action + assertSuperadmin guard (this plan renders them in UI)

provides:
  - Superadmin route group at /superadmin/* with is_superadmin layout guard
  - Create company page at /superadmin/companies/new with form and result display
  - Sihirbaz Telegram webhook route at /api/telegram/sihirbaz with idempotency

affects: [phase-16-wizard, phase-19-superadmin-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Route group isolation: (superadmin) route group with server-side role guard in layout.tsx
    - useActionState with Server Action: client form calling createCompany, displaying tempPassword + deepLink on success
    - Webhook skeleton pattern: Phase N stub with after() + idempotency, Phase N+1 replaces with full handler

key-files:
  created:
    - src/app/(superadmin)/layout.tsx
    - src/app/(superadmin)/superadmin/page.tsx
    - src/app/(superadmin)/superadmin/companies/new/page.tsx
    - src/components/superadmin/create-company-form.tsx
    - src/app/api/telegram/sihirbaz/route.ts
  modified: []

key-decisions:
  - "useActionState (React 19, not deprecated useFormState) used in create-company-form.tsx"
  - "Superadmin layout redirects non-superadmin to /admin (not /login) — superadmins need admin UI access"
  - "Sihirbaz route does NOT import dispatchAgentUpdate — wizard is NOT an AI agent"
  - "Placeholder Turkish reply in sihirbaz after() callback — friendly UX before Phase 16 deploys"
  - "Idempotency INSERT via processed_telegram_updates with 23505 dedup, same as all 12 agent routes"

patterns-established:
  - "Superadmin route group: (superadmin)/layout.tsx checks users.role='superadmin', redirects to /admin otherwise"
  - "Webhook skeleton: after() + idempotency pattern with Phase N+1 stub comment for future implementation"

requirements-completed: [SA-01, SA-06, KS-08]

# Metrics
duration: 16min
completed: 2026-03-06
---

# Phase 15 Plan 02: Company Creation Infrastructure Summary

**Superadmin create-company UI at /superadmin/companies/new with role guard + Sihirbaz Telegram webhook skeleton using after() idempotency pattern**

## Performance

- **Duration:** 16 min
- **Started:** 2026-03-06T11:42:34Z
- **Completed:** 2026-03-06T11:58:50Z
- **Tasks:** 2
- **Files modified:** 5 (all created)

## Accomplishments
- Superadmin route group with layout guard — non-superadmin users are redirected to /admin
- Create company form at /superadmin/companies/new using React 19 useActionState with createCompany Server Action
- Form success state displays company ID, temp password, and Telegram deep link with warning
- Sihirbaz webhook route at /api/telegram/sihirbaz — idempotency + after() pattern, placeholder Turkish reply
- pnpm build passes with exit code 0 — /superadmin and /superadmin/companies/new both in build output

## Task Commits

Each task was committed atomically:

1. **Task 1: Create superadmin route group with layout guard and create-company page** - `e863d38` (feat)
2. **Task 2: Create Sihirbaz Telegram webhook route skeleton** - `c28dc76` (feat)

**Plan metadata:** (to be committed below)

## Files Created/Modified
- `src/app/(superadmin)/layout.tsx` - Server component layout with superadmin role guard (redirects to /admin)
- `src/app/(superadmin)/superadmin/page.tsx` - Placeholder dashboard with link to company creation
- `src/app/(superadmin)/superadmin/companies/new/page.tsx` - Create company page rendering CreateCompanyForm
- `src/components/superadmin/create-company-form.tsx` - Client form using useActionState(createCompany), shows tempPassword + deepLink on success
- `src/app/api/telegram/sihirbaz/route.ts` - Sihirbaz webhook skeleton with idempotency and after() pattern

## Decisions Made
- useActionState from React 19 used (not deprecated useFormState) — matches v3.0 React 19 stack
- Superadmin layout redirects non-superadmin to /admin (not /catalog or /login) — superadmins need admin UI; matches Phase 15-01 decision
- Sihirbaz route is NOT an AI agent — does not import dispatchAgentUpdate; Phase 16 will add WizardOrchestrator FSM
- Placeholder Turkish reply ("Kurulum Sihirbazi henuz hazir degil") sent in after() stub — friendly UX before Phase 16 deploys
- Plain HTML form elements with Tailwind classes used (no shadcn/ui) — matches existing admin form patterns

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

All 5 files confirmed present. Both commits (e863d38, c28dc76) confirmed in git log.

## Issues Encountered
None — all 5 files compiled cleanly on first attempt, pnpm build passed with exit code 0.

## User Setup Required
None — no external service configuration required for this plan. The TELEGRAM_BOT_TOKEN_SIHIRBAZ env var is read but not required for the build.

## Next Phase Readiness
- Phase 16 (Wizard FSM) can now register the Sihirbaz bot webhook URL and replace the stub in sihirbaz/route.ts with dispatchSihirbazUpdate()
- /superadmin/companies/new is fully functional — superadmin can create companies and see invite links
- Phase 19 builds the full superadmin dashboard — the current /superadmin placeholder page is intentionally minimal

---
*Phase: 15-company-creation-infrastructure*
*Completed: 2026-03-06*
